import { authorized } from '../../utils/helpers'
import {
  RecommendLabelsError,
  RecommendLabelsSuccess,
  RecommendLabelsErrorCode,
  Label,
} from '../../generated/graphql'
import { appDataSource } from '../../data_source'
import { QueryRecommendLabelsArgs } from '../../generated/graphql'
import { QueryRunner } from 'typeorm'

export const recommendLabelsResolver = authorized<
  RecommendLabelsSuccess,
  RecommendLabelsError,
  QueryRecommendLabelsArgs
>(async (_, { articleId }, { uid, log }) => {
  try {
    const queryRunner = (await appDataSource
      .createQueryRunner()
      .connect()) as QueryRunner

    const { rows: savedArticle } = (await queryRunner.query(
      `SELECT * FROM "omnivore"."library_item" WHERE id = $1`,
      [articleId]
    )) as { rows: { slug: string; user_id: string }[] } // Better way to do this, but later.

    if (savedArticle.length == 0) {
      return {
        __typename: 'RecommendLabelsError',
        errorCodes: [RecommendLabelsErrorCode.NotFound],
      }
    }

    if (savedArticle[0]?.user_id != uid) {
      return {
        __typename: 'RecommendLabelsError',
        errorCodes: [RecommendLabelsErrorCode.Unauthorized],
      }
    }

    // OK, so first... deslugify the url.
    const splitSlug = savedArticle[0].slug.split('-')
    const removedUniqueIdSlug = splitSlug
      .slice(0, splitSlug.length - 1)
      .join('-')

    console.log(removedUniqueIdSlug)
    const { rows: embeddedArticle } = (await queryRunner.query(
      `SELECT embedding FROM "article_embeddings" where slug = $1 or slug = $2`,
      [removedUniqueIdSlug, savedArticle[0].slug]
    )) as { rows: { embedding: number[] }[] }

    if (embeddedArticle.length == 0) {
      return {
        __typename: 'RecommendLabelsError',
        errorCodes: [RecommendLabelsErrorCode.NotFound],
      }
    }

    const { rows: similarLabels } = (await queryRunner.query(
      `SELECT * FROM (SELECT id, name, description, created_at AS "createdAt", color, (1 - (embed.embedding <=> (SELECT embedding FROM "article_embeddings" where slug = $1 or slug = $2)) - 0.6) / 0.2 AS "similarity" FROM label_embeddings embed
                INNER JOIN (SELECT LOWER(name) lower, name, id, description, created_at, color FROM omnivore.labels WHERE user_id = $3) label on label.lower = embed.label
                order by "similarity" desc) comparisons`,
      [removedUniqueIdSlug, savedArticle[0].slug, uid]
    )) as { rows: (Label & { similarity: number })[] }

    await queryRunner.release()

    console.log(similarLabels)
    if (similarLabels.some((it) => it.similarity > 0.8)) {
      return {
        __typename: 'RecommendLabelsSuccess',
        labels: similarLabels.filter((it) => it.similarity > 0.8),
      }
    }

    if (similarLabels.some((it) => it.similarity > 0.75)) {
      return {
        __typename: 'RecommendLabelsSuccess',
        labels: similarLabels.filter((it) => it.similarity > 0.75).slice(0, 2),
      }
    }

    // This might create more problems, but they are ranked, and there should be nothing below 0.7.
    return {
      __typename: 'RecommendLabelsSuccess',
      labels: similarLabels.slice(0, 1),
    }
  } catch (error) {
    log.error('Error deleting rule', error)

    return {
      __typename: 'RecommendLabelsError',
      errorCodes: [RecommendLabelsErrorCode.BadRequest],
    }
  }
})
