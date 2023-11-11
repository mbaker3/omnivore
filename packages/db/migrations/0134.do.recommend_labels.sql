-- Type: DO
-- Name: recommend_labels
-- Description: Use this table to query against label similarity to an article.

CREATE TABLE omnivore.label_embeddings (label varchar, embedding vector(1536));
CREATE UNIQUE INDEX label_embedding_name on omnivore.label_embeddings(label);
