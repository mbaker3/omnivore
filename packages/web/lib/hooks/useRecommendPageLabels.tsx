import { Label } from '../networking/fragments/labelFragment'
import { gql } from "graphql-request"
import useSWR from "swr"
import { makeGqlFetcher } from "../networking/networkHelpers"
import { useState } from "react"


export const useRecommendPageLabels = (
  articleId: string
): Label[] => {

  const query = gql`
    query RecommendSearch {
      recommendLabels(articleId: "${articleId}")  {
        ... on RecommendLabelsSuccess {
          labels {
            id
            color
            name
            createdAt
          }
        }
        ... on RecommendLabelsError {
          errorCodes
        }
      }
    }
  `

  const { data, error } = useSWR(query, makeGqlFetcher({articleId}))

  if (data) {
    return data.recommendLabels?.labels ?? []
  }

  return [];
}
