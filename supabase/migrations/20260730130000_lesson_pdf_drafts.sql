begin;

drop policy if exists lesson_pdfs_insert on storage.objects;
create policy lesson_pdfs_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'lesson-pdfs'
  and public.is_active_account()
  and exists (
    select 1 from public.lessons lesson
    where lesson.course_id::text = (storage.foldername(name))[1]
      and lesson.id = (storage.foldername(name))[2]
      and name = lesson.course_id::text || '/' || lesson.id || '/lesson.pdf'
      and lesson.created_by = auth.uid()
      and lesson.pdf_path is null
      and public.is_course_owner(lesson.course_id)
  )
);

commit;
