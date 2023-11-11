-- Type: UNDO
-- Name: article_embeddings
-- Description: Tables store articles, and their associated embedding.

CREATE TYPE article_embedding_types as ENUM("SYSTEM", "USER");
CREATE TABLE article_embeddings (slug varchar, author varchar, description varchar, img varchar, publishedDate TIMESTAMP, title varchar, embedding vector(1536), type article_embedding_types );
CREATE unique index article_embeddings_slug on article_embeddings (slug);
