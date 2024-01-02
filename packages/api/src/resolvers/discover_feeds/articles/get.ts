import { authorized } from '../../utils/helpers'
import {
  GetDiscoveryArticleErrorCode,
  GetDiscoveryFeedArticleSuccess,
  GetDiscoveryFeedArticleError,
  QueryGetDiscoveryFeedArticlesArgs,
  GetDiscoveryFeedArticleErrorCode,
} from '../../generated/graphql'
import { appDataSource } from '../../data_source'
import { QueryRunner } from 'typeorm'

type DiscoverFeedArticleDBRows = {
  rows: {
    id: string
    feed: string
    title: string
    slug: string
    url: string
    author: string
    image: string
    published_at: Date
    description: string
    saves: number
    article_save_id: string | undefined
    article_save_url: string | undefined
  }[]
}

const getPopularTopics = (
  queryRunner: QueryRunner,
  uid: string,
  after: string,
  amt: number,
  feedId: string | null = null,
): Promise<DiscoverFeedArticleDBRows> => {
  const params = [uid, amt + 1, after]
  if (feedId) {
    params.push(feedId)
  }
  return queryRunner.query(
    `
      SELECT id, title, feed_id as feed, slug, description, url, author, image, published_at, COALESCE(sl.count / (EXTRACT(EPOCH FROM (NOW() - published_at)) / 3600 / 24), 0) as popularity_score, article_save_id, article_save_url
      FROM omnivore.omnivore.discover_feed_articles 
      LEFT JOIN (SELECT discover_article_id as article_id, count(*) as count FROM omnivore.discover_save_link group by discover_article_id) sl on id=sl.article_id
      LEFT JOIN ( SELECT discover_article_id, article_save_id, article_save_url FROM omnivore.discover_save_link WHERE user_id=$1 and deleted = false) su on id=su.discover_article_id
      WHERE COALESCE(sl.count / (EXTRACT(EPOCH FROM (NOW() - published_at)) / 3600 / 24), 0)  > 0.0
      AND feed_id in (SELECT feed_id FROM omnivore.discover_feed_subscription WHERE user_id= $1) 
      ${feedId != null ? `AND feed_id = $4` : ''}
      ORDER BY popularity_score DESC
      LIMIT $2 OFFSET $3
      `,
    params,
  ) as Promise<DiscoverFeedArticleDBRows>
}

const getAllTopics = (
  queryRunner: QueryRunner,
  uid: string,
  after: string,
  amt: number,
  feedId: string | null = null,
): Promise<DiscoverFeedArticleDBRows> => {
  const params = [uid, amt + 1, after]
  if (feedId) {
    params.push(feedId)
  }
  return queryRunner.query(
    `
      SELECT id, title, feed_id as feed, slug, description, url, author, image, published_at, article_save_id, article_save_url
      FROM omnivore.omnivore.discover_feed_articles 
      LEFT JOIN (SELECT discover_article_id as article_id, count(*) as count FROM omnivore.discover_feed_save_link group by discover_article_id) sl on id=sl.article_id
      LEFT JOIN ( SELECT discover_article_id, article_save_id, article_save_url FROM omnivore.discover_feed_save_link WHERE user_id=$1 and deleted = false) su on id=su.discover_article_id
      WHERE feed_id in (SELECT feed_id FROM omnivore.discover_feed_subscription WHERE user_id= $1) 
      ${feedId != null ? `AND feed_id = $4` : ''}
      ORDER BY published_at DESC
      LIMIT $2 OFFSET $3
      `,
    params,
  ) as Promise<DiscoverFeedArticleDBRows>
}

const getTopicInformation = (
  queryRunner: QueryRunner,
  discoveryTopicId: string,
  uid: string,
  after: string,
  amt: number,
  feedId: string | null = null,
): Promise<DiscoverFeedArticleDBRows> => {
  const params = [uid, discoveryTopicId, amt + 1, Number(after)]
  if (feedId) {
    params.push(feedId)
  }
  return queryRunner.query(
    `
      SELECT id, title, feed_id as feed, slug, description, url, author, image, published_at, COALESCE(sl.count, 0) as saves, article_save_id, article_save_url
      FROM omnivore.discover_feed_article_topic_link 
      INNER JOIN omnivore.discover_feed_articles on id=discover_feed_article_id  
      LEFT JOIN (SELECT discover_article_id as article_id, count(*) as count FROM omnivore.discover_feed_save_link group by discover_article_id) sl on id=sl.article_id
      LEFT JOIN ( SELECT discover_article_id, article_save_id, article_save_url FROM omnivore.discover_feed_save_link WHERE user_id=$1 and deleted = false) su on id=su.discover_article_id
      WHERE discover_topic_name=$2
      AND feed_id in (SELECT feed_id FROM omnivore.discover_feed_subscription WHERE user_id = $1) 
      ${feedId != null ? `AND feed_id = $5` : ''}
      ORDER BY published_at DESC
      LIMIT $3 OFFSET $4
      `,
    params,
  ) as Promise<DiscoverFeedArticleDBRows>
}

export const getDiscoveryFeedArticlesResolver = authorized<
  GetDiscoveryFeedArticleSuccess,
  GetDiscoveryFeedArticleError,
  QueryGetDiscoveryFeedArticlesArgs
>(async (_, { discoveryTopicId, feedId, first, after }, { uid, log }) => {
  try {
    const startCursor: string = after || ''
    const firstAmnt = Math.min(first || 10, 100) // limit to 100 items

    const queryRunner = (await appDataSource
      .createQueryRunner()
      .connect()) as QueryRunner

    const { rows: topics } = (await queryRunner.query(
      `SELECT * FROM "omnivore"."discover_topics" WHERE "name" = $1`,
      [discoveryTopicId],
    )) as { rows: unknown[] }

    if (topics.length == 0) {
      return {
        __typename: 'GetDiscoveryFeedArticleError',
        errorCodes: [GetDiscoveryFeedArticleErrorCode.Unauthorized], // TODO - no.
      }
    }

    let discoverArticles: DiscoverFeedArticleDBRows = { rows: [] }
    if (discoveryTopicId === 'Popular') {
      discoverArticles = await getPopularTopics(
        queryRunner,
        uid,
        startCursor,
        firstAmnt,
        feedId ?? null,
      )
    } else if (discoveryTopicId === 'All') {
      discoverArticles = await getAllTopics(
        queryRunner,
        uid,
        startCursor,
        firstAmnt,
        feedId ?? null,
      )
    } else {
      discoverArticles = await getTopicInformation(
        queryRunner,
        discoveryTopicId,
        uid,
        startCursor,
        firstAmnt,
        feedId ?? null,
      )
    }

    await queryRunner.release()

    return {
      __typename: 'GetDiscoveryFeedArticleSuccess',
      discoverArticles: discoverArticles.rows.slice(0, firstAmnt).map((it) => ({
        author: it.author,
        id: it.id,
        feed: it.feed,
        slug: it.slug,
        publishedDate: it.published_at,
        description: it.description,
        url: it.url,
        title: it.title,
        image: it.image,
        saves: it.saves,
        savedLinkUrl: it.article_save_url,
        savedId: it.article_save_id,
        __typename: 'DiscoveryFeedArticle',
        siteName: it.url,
      })),
      pageInfo: {
        endCursor: `${
          Number(startCursor) +
          Math.min(discoverArticles.rows.length, firstAmnt)
        }`,
        hasNextPage: discoverArticles.rows.length > firstAmnt,
        hasPreviousPage: Number(startCursor) != 0,
        startCursor: Number(startCursor).toString(),
        totalCount: Math.min(discoverArticles.rows.length, firstAmnt),
      },
    }
  } catch (error) {
    log.error('Error Getting Discovery Feed Articles', error)

    return {
      __typename: 'GetDiscoveryFeedArticleError',
      errorCodes: [GetDiscoveryFeedArticleErrorCode.Unauthorized],
    }
  }
})
