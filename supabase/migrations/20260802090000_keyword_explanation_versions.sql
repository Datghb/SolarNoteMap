begin;

alter table public.keyword_definitions
  add column if not exists definition_version text not null default 'v1-contextual';

comment on column public.keyword_definitions.definition_version is
  'v2-pedagogical definitions are independently generated explanations; v1 values are legacy contextual snippets.';

commit;
