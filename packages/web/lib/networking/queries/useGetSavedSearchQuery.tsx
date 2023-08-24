import { gql } from 'graphql-request'
import useSWR from 'swr'
import { publicGqlFetcher } from '../networkHelpers'

type SavedSearchResponse = {
  savedSearch?: SavedSearch[]
  savedSearchErrors?: unknown
  isLoading: boolean
}

type SavedSearchResponseData = {
  savedSearch: SavedSearch[]
}

export type SavedSearch = {
  name: string
  query: string
  location: number
}

export function useGetSavedSearchQuery(): SavedSearchResponse {
  const query = gql`
    query SavedLinks {
      savedSearches {
        ... on SavedSearchesSuccess { 
          savedSearch { 
            name,
            query, 
            location
          }
        }
      }
    }
  `

  const { data, error } = useSWR(query, publicGqlFetcher);
  const { savedSearch } = data as SavedSearchResponseData

  return {
    savedSearch: [],
    savedSearchErrors: error, // TODO: figure out error possibilities
    isLoading: !error && !data,
  }
}
