begin;

alter table public.lessons
  add column summary text,
  add column summary_model text,
  add column summary_pdf_path text,
  add column summarized_at timestamptz;

alter table public.lessons
  add constraint lessons_summary_length
  check (summary is null or char_length(summary) <= 20000),
  add constraint lessons_summary_source_consistency
  check (
    (summary is null and summary_model is null and summary_pdf_path is null and summarized_at is null)
    or
    (summary is not null and summary_model is not null and summarized_at is not null)
  );

comment on column public.lessons.summary is
  'Durable AI-generated summary of the current lesson PDF.';
comment on column public.lessons.summary_pdf_path is
  'PDF path used to generate summary; a mismatch requires regeneration.';

commit;
