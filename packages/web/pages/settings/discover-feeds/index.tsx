import { useRouter } from 'next/router'
import { FloppyDisk, Pencil, XCircle } from 'phosphor-react'
import { useMemo, useState } from 'react'
import { FormInput } from '../../../components/elements/FormElements'
import { HStack, SpanBox } from '../../../components/elements/LayoutPrimitives'
import { ConfirmationModal } from '../../../components/patterns/ConfirmationModal'
import {
  EmptySettingsRow,
  SettingsTable,
  SettingsTableRow,
} from '../../../components/templates/settings/SettingsTable'
import { theme } from '../../../components/tokens/stitches.config'
import { unsubscribeMutation } from '../../../lib/networking/mutations/unsubscribeMutation'
import {
  UpdateSubscriptionInput,
  updateSubscriptionMutation,
} from '../../../lib/networking/mutations/updateSubscriptionMutation'
import {
  SubscriptionStatus,
  SubscriptionType,
  useGetSubscriptionsQuery,
} from '../../../lib/networking/queries/useGetSubscriptionsQuery'
import { applyStoredTheme } from '../../../lib/themeUpdater'
import { showErrorToast, showSuccessToast } from '../../../lib/toastHelpers'
import { formatMessage } from '../../../locales/en/messages'
import { useGetDiscoverFeeds } from "../../../lib/networking/queries/useGetDiscoverFeeds"

export default function DiscoverFeedsSettings(): JSX.Element {
  const router = useRouter()
  const { feeds, revalidate, isValidating } = useGetDiscoverFeeds()
  const [onDeleteId, setOnDeleteId] = useState<string>('')
  const [onEditId, setOnEditId] = useState('')
  const [onEditName, setOnEditName] = useState('')
  const [onPauseId, setOnPauseId] = useState('')
  const [onEditStatus, setOnEditStatus] = useState<SubscriptionStatus>()

  const sortedFeeds = useMemo(() => {
    if (!feeds) {
      return []
    }
    return feeds
  }, [feeds])

  async function updateSubscription(
    input: UpdateSubscriptionInput
  ): Promise<void> {
    const result = await updateSubscriptionMutation(input)

    if (result.updateSubscription.errorCodes) {
      const errorMessage = formatMessage({
        id: `error.${result.updateSubscription.errorCodes[0]}`,
      })
      showErrorToast(`failed to update subscription: ${errorMessage}`, {
        position: 'bottom-right',
      })
      return
    }

    showSuccessToast('Feed updated', { position: 'bottom-right' })
    revalidate()
  }

  async function onDelete(id: string): Promise<void> {
    const result = await unsubscribeMutation('', id)
    if (result) {
      showSuccessToast('Feed unsubscribed', { position: 'bottom-right' })
    } else {
      showErrorToast('Failed to unsubscribe', { position: 'bottom-right' })
    }
    revalidate()
  }

  async function onPause(
    id: string,
    status: SubscriptionStatus = 'UNSUBSCRIBED'
  ): Promise<void> {
    const result = await updateSubscriptionMutation({
      id,
      status,
    })

    const action = status == 'UNSUBSCRIBED' ? 'pause' : 'resume'

    if (result) {
      showSuccessToast(`Feed ${action}d`, {
        position: 'bottom-right',
      })
    } else {
      showErrorToast(`Failed to ${action}`, { position: 'bottom-right' })
    }
    revalidate()
  }

  applyStoredTheme(false)

  return (
    <SettingsTable
      pageId={'feeds'}
      pageInfoLink="https://docs.omnivore.app/using/feeds.html"
      headerTitle="Subscribed feeds"
      createTitle="Add a Discover feed"
      createAction={() => {
        router.push('/settings/discover-feeds/add')
      }}
      suggestionInfo={{
        title: 'Add RSS and Atom feeds to your Omnivore account',
        message:
          'When you add a new feed the last 24hrs of items, or at least one item will be added to your account. Feeds will be checked for updates every hour, and new items will be added to your Following. You can also add feeds to your Library by checking the box below.',
        docs: 'https://docs.omnivore.app/using/feeds.html',
        key: '--settings-feeds-show-help',
        CTAText: 'Add a feed',
        onClickCTA: () => {
          router.push('/settings/discover-feeds/add')
        },
      }}
    >
      {sortedFeeds.length === 0 ? (
        <EmptySettingsRow text={isValidating ? '-' : 'No feeds subscribed'} />
      ) : (
        sortedFeeds.map((feed, i) => {
          return (
            <SettingsTableRow
              key={feed.title}
              title={
                onEditId === feed.title ? (
                  <HStack alignment={'center'} distribution={'start'}>
                    <FormInput
                      value={onEditName}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setOnEditName(e.target.value)}
                      placeholder="Description"
                      css={{
                        m: '0px',
                        fontSize: '18px',
                        '@mdDown': {
                          fontSize: '12px',
                          fontWeight: 'bold',
                        },
                        width: '400px',
                      }}
                    />
                    <HStack>
                      <FloppyDisk
                        style={{ cursor: 'pointer', marginLeft: '5px' }}
                        color={theme.colors.omnivoreCtaYellow.toString()}
                        onClick={async (e) => {
                          e.stopPropagation()
                          await updateSubscription({
                            id: onEditId,
                            name: onEditName,
                          })
                          setOnEditId('')
                        }}
                      />
                      <XCircle
                        style={{ cursor: 'pointer', marginLeft: '5px' }}
                        color={theme.colors.omnivoreRed.toString()}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOnEditId('')
                          setOnEditName('')
                        }}
                      />
                    </HStack>
                  </HStack>
                ) : (
                  <HStack alignment={'center'} distribution={'start'}>
                    <SpanBox
                      css={{
                        m: '0px',
                        fontSize: '18px',
                        '@mdDown': {
                          fontSize: '12px',
                          fontWeight: 'bold',
                        },
                      }}
                    >
                      {feed.visibleName}
                    </SpanBox>
                    <Pencil
                      style={{ cursor: 'pointer', marginLeft: '5px' }}
                      color={theme.colors.omnivoreLightGray.toString()}
                      onClick={(e) => {
                        e.stopPropagation()
                        setOnEditName(feed.visibleName)
                        setOnEditId(feed.id)
                      }}
                    />
                  </HStack>
                )
              }
              isLast={i === sortedFeeds.length - 1}
              onDelete={() => {
                console.log('onDelete triggered: ', feed.title)
                setOnDeleteId(feed.id)
              }}
              deleteTitle="Unsubscribe"
              sublineElement={
                <SpanBox
                  css={{
                    my: '8px',
                    fontSize: '11px',
                  }}
                >
                  {`URL: ${feed.link}, `}
                </SpanBox>
              }
              onClick={() => {
                // router.push(`/home?q=in:inbox rss:"${subscription.url}"`)
              }}
              // extraElement={
              //   <HStack
              //     distribution="start"
              //     alignment="center"
              //     css={{
              //       padding: '0 5px',
              //     }}
              //   >
              //     <CheckboxComponent
              //       checked={!!subscription.autoAddToLibrary}
              //       setChecked={async (checked) => {
              //         await updateSubscriptionMutation({
              //           id: subscription.id,
              //           autoAddToLibrary: checked,
              //         })
              //         revalidate()
              //       }}
              //     />
              //     <SpanBox
              //       css={{
              //         padding: '0 5px',
              //         fontSize: '12px',
              //       }}
              //     >
              //       Auto add to library
              //     </SpanBox>
              //   </HStack>
              // }
            />
          )
        })
      )}

      {onDeleteId && (
        <ConfirmationModal
          message={'Feed will be unsubscribed. This action cannot be undone.'}
          onAccept={async () => {
            await onDelete(onDeleteId)
            setOnDeleteId('')
          }}
          onOpenChange={() => setOnDeleteId('')}
        />
      )}

      {onPauseId && (
        <ConfirmationModal
          message={`Feed will be ${
            onEditStatus === 'UNSUBSCRIBED' ? 'paused' : 'resumed'
          }. You can ${
            onEditStatus === 'UNSUBSCRIBED' ? 'resume' : 'pause'
          } it at any time.`}
          onAccept={async () => {
            await onPause(onPauseId, onEditStatus)
            setOnPauseId('')
            setOnEditStatus(undefined)
          }}
          onOpenChange={() => {
            setOnPauseId('')
            setOnEditStatus(undefined)
          }}
        />
      )}
    </SettingsTable>
  )
}