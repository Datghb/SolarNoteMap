# Solar Note Map

> Một nền tảng học tập tương tác với hệ thống hành tinh 3D, bản đồ tri thức AI và lớp học đám mây.

![Solar Note Map interface](./image.png)

## Tổng quan

Solar Note Map là ứng dụng học tập trực tuyến được xây dựng bằng React, TypeScript và Three.js. Thay vì tổ chức ghi chú dạng danh sách, người học khám phá khóa học AI qua hệ thống hành tinh 3D và xây dựng bản đồ tri thức trực quan cho từng bài học.

Ứng dụng sử dụng Node.js server để bảo vệ API key, tích hợp OpenAI và các API OpenAI-compatible (Groq/ZenMux/Kira) để tạo bản đồ tri thức và tóm tắt bài học, đồng thời lưu trữ dữ liệu qua Supabase với hệ thống phân quyền đầy đủ (Admin, Teacher, Student).

## Tính năng

### Hệ thống phân quyền 3 cấp

**Admin** - Quản trị viên hệ thống:
- Xem tổng quan tất cả tài khoản, khóa học và lớp học
- Chuyển đổi vai trò giữa Student và Teacher
- Khóa/mở khóa tài khoản
- Không có quyền truy cập vào ghi chú và bản đồ riêng tư của học viên

**Teacher** - Giáo viên:
- Tạo và quản lý Course Program (chương trình khóa học)
- Tạo bài học từ file PDF
- Tạo và quản lý nhiều lớp học (Class)
- Mỗi lớp có mã tham gia riêng (join code)
- Lên lịch phát hành bài học cho từng lớp
- Xem hoạt động học tập của học viên trong lớp

**Student** - Học viên:
- Tham gia lớp học bằng mã lớp
- Chuyển đổi giữa các lớp đã tham gia
- Chỉ thấy bài học đã được phát hành cho lớp hiện tại
- Ghi chú, bản đồ tri thức và hoạt động được cách ly theo lớp

### Khám phá vũ trụ học tập 3D

- Hệ thống hành tinh 3D với quỹ đạo, vành đai tiểu hành tinh, vệ tinh, sao, tinh vân và sao chổi
- Kéo để xoay, cuộn để phóng to/thu nhỏ, chọn hành tinh để mở bài học
- Hiện/ẩn quỹ đạo và tạm dừng/tiếp tục chuyển động hành tinh
- Hiển thị vệ tinh tri thức sau khi học viên lưu bản đồ

### Học với PDF tương tác

- Giáo viên tải PDF lên làm tài liệu bài học (được lưu trữ riêng tư trong Supabase)
- PDF được render sắc nét ngay trong trình duyệt
- Điều hướng trang, đánh dấu ghim trực tiếp lên trang PDF
- Viết ghi chú riêng cho từng trang
- Mở câu hỏi cộng đồng liên kết đến chính xác trang PDF đó

### Xây dựng bản đồ tri thức AI

- Tự động tạo bản đồ kiến thức từ bản tóm tắt nội dung slide
- Lưu ghi chú riêng cho từng slide; ghi chú hoạt động độc lập và không làm thay đổi sơ đồ
- Lưu một sơ đồ nền dùng chung cho bài học để học viên không phải gọi AI lại
- Mỗi khái niệm lưu các slide nguồn và hỗ trợ mở lại đúng trang liên quan
- Xem trước bản đồ đang phát triển ngay bên slide, mở đồ họa đầy đủ khi cần
- Tạo khái niệm và mối quan hệ ngữ nghĩa qua OpenAI hoặc API OpenAI-compatible
- Fallback về phát hiện khái niệm cục bộ khi AI không khả dụng
- Render chòm sao tri thức hình tròn tương tác với React Flow
- Focus một nhánh, các khái niệm không liên quan sẽ mờ đi
- Xem, chỉnh sửa, xác nhận, kéo thả và xóa các node tri thức
- Dùng AI reflection review để xác định điểm mạnh và câu hỏi đáng khám phá tiếp
- Zoom in, zoom out hoặc reset workspace
- Lưu bản đồ riêng cho từng bài học

### Tóm tắt bài học tự động

- AI tự động tạo tóm tắt cho bài học từ nội dung PDF
- Lưu cache tóm tắt để tăng tốc độ load
- Hỗ trợ nhiều AI provider (OpenAI, Groq)
- Từ điển thuật ngữ AI được quản lý (CSV glossary)

### Cộng đồng học tập

- Đặt câu hỏi liên kết đến slide cụ thể nơi xuất hiện khó khăn
- Lọc thảo luận theo slide, vote câu hỏi và trả lời
- Nhảy từ thảo luận về đúng slide nguồn
- Bắt đầu câu hỏi có ngữ cảnh trực tiếp từ workspace bài học
- Dữ liệu thảo luận được lưu trữ trong Supabase, cách ly theo lớp học

## Công nghệ sử dụng

| Lĩnh vực | Công nghệ |
| --- | --- |
| Frontend | React 19, TypeScript, React Flow |
| Đồ họa 3D | Three.js, React Three Fiber, Drei |
| AI | OpenAI / Groq / ZenMux / Kira, Structured Outputs hoặc JSON validation |
| Backend | Node.js, Express |
| Database & Auth | Supabase (PostgreSQL, Row Level Security, Auth) |
| File storage | Supabase Storage (PDFs) |
| Graph layout | Custom deterministic radial constellation |
| Styling | Tailwind CSS 4, CSS |
| Build tool | Vite 7 |
| Bundling | vite-plugin-singlefile |
| PDF rendering | PDF.js |

## Bắt đầu

### Yêu cầu

- Node.js `20.19+` hoặc `22.12+`
- npm
- Trình duyệt hiện đại hỗ trợ WebGL
- Tài khoản Supabase (miễn phí)
- API key từ ít nhất một provider: OpenAI, Groq, ZenMux hoặc Kira

### Cài đặt

**1. Clone repository:**
```bash
git clone https://github.com/Datghb/SolarNoteMap.git
cd SolarNoteMap
npm install
```

**2. Thiết lập Supabase:**

- Tạo project mới tại [supabase.com](https://supabase.com)
- Mở **SQL Editor** và chạy từng migration theo thứ tự timestamp trong thư mục `supabase/migrations/`
- Chạy tất cả file từ `20260729103000_initial_auth_classroom.sql` đến migration mới nhất

**Bật đăng nhập nhanh bằng Google:**

1. Trong Google Auth Platform, tạo OAuth client loại **Web application**.
2. Thêm Authorized redirect URI do trang **Supabase Dashboard → Authentication → Providers → Google** cung cấp. URI có dạng `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Điền Google Client ID và Client Secret vào provider Google trên Supabase rồi bật provider.
4. Trong **Supabase Dashboard → Authentication → URL Configuration**, đặt Site URL của ứng dụng và thêm các Redirect URLs được dùng, ví dụ `http://localhost:5173/**` khi phát triển và URL HTTPS của bản production.

Client Secret chỉ được lưu trong Google/Supabase Dashboard, không thêm vào `.env.local` hay source code.

**3. Tạo file `.env.local`:**

```env
# AI Provider: openai, groq, zenmux hoặc kira
AI_PROVIDER=groq
AI_MODEL=qwen/qwen3.6-27b

# Groq API (miễn phí tại https://console.groq.com)
GROQ_API_KEY=gsk_your_key_here

# Hoặc dùng OpenAI
OPENAI_API_KEY=sk-your-key-here

# Hoặc dùng ZenMux
# AI_PROVIDER=zenmux
# AI_MODEL=z-ai/glm-4.6v-flash-free
# ZENMUX_API_KEY=your-zenmux-key-here

# Hoặc dùng Kira
# AI_PROVIDER=kira
# AI_MODEL=kira-mini-1.0
# KIRA_API_KEY=your-kira-key-here

# Supabase (lấy từ project settings)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here

# Adaptive quiz Phase 1: mặc định tắt
VITE_ADAPTIVE_QUIZ_ENABLED=false
ADAPTIVE_QUIZ_ENABLED=false
VITE_ADAPTIVE_QUIZ_PHASE2_ENABLED=false
ADAPTIVE_QUIZ_PHASE2_ENABLED=false

# Tùy chọn: tách provider tạo quiz khỏi provider tạo summary/sơ đồ
# Nếu bỏ trống, quiz tiếp tục dùng AI_PROVIDER và AI_MODEL như trước.
# QUIZ_AI_PROVIDER=kira
# QUIZ_AI_MODEL=kira-mini-1.0
# QUIZ_AI_BASE_URL=https://kiraai.vn/api/v1
# QUIZ_AI_API_KEY=your-quiz-provider-key-here
```

> **Lưu ý:** Không bao giờ thêm prefix `VITE_` vào API key của AI provider. Chỉ Supabase credentials mới có prefix `VITE_`.

Sau khi đổi `AI_PROVIDER` hoặc `AI_MODEL`, dừng `npm run dev` bằng `Ctrl+C` rồi chạy lại. ZenMux dùng endpoint OpenAI-compatible `https://zenmux.ai/api/v1`; hệ thống ưu tiên `ZENMUX_API_KEY` và vẫn chấp nhận `GLM_API_KEY` làm alias. Kira dùng endpoint `https://kiraai.vn/api/v1` theo cấu hình OpenAI-compatible. Chỉ cần cấu hình key của provider đang được chọn.

`AI_PROVIDER`/`AI_MODEL` luôn phục vụ pipeline cũ gồm summary và knowledge graph. Quiz có bộ cấu hình server-only độc lập gồm `QUIZ_AI_PROVIDER`, `QUIZ_AI_BASE_URL`, `QUIZ_AI_MODEL`, `QUIZ_AI_API_KEY`. Key Quiz luôn được ưu tiên hơn key provider chính, nên có thể dùng hai Groq API key khác nhau. Có thể dùng key theo provider như `QUIZ_GROQ_API_KEY`, `QUIZ_ZENMUX_API_KEY`, `QUIZ_KIRA_API_KEY`, `QUIZ_OPENAI_API_KEY`; key này có độ ưu tiên cao nhất. Nếu không có bất kỳ biến `QUIZ_*` nào, quiz dùng lại cấu hình AI chính và hành vi giữ nguyên như trước.

Ví dụ dùng hai Groq API key độc lập cho sơ đồ và quiz:

```env
AI_PROVIDER=groq
AI_MODEL=qwen/qwen3.6-27b
GROQ_API_KEY=gsk_graph_key

QUIZ_AI_PROVIDER=groq
QUIZ_AI_BASE_URL=https://api.groq.com/openai/v1
QUIZ_AI_MODEL=qwen/qwen3.6-27b
QUIZ_AI_API_KEY=gsk_quiz_key
```

Với một API Chat Completions tương thích OpenAI chưa có tên trong hệ thống, dùng `custom`:

```env
QUIZ_AI_PROVIDER=custom
QUIZ_AI_BASE_URL=https://your-provider.example/v1
QUIZ_AI_MODEL=provider/model-name
QUIZ_AI_API_KEY=your-custom-key
```

`custom` chỉ áp dụng giao thức OpenAI-compatible Chat Completions. Khi đổi cấu hình, phải khởi động lại `npm run dev`. Không đặt prefix `VITE_` trước các key này.

Ví dụ giữ Groq để tạo sơ đồ, dùng Kira cho quiz:

```env
AI_PROVIDER=groq
AI_MODEL=qwen/qwen3.6-27b
GROQ_API_KEY=gsk_...

QUIZ_AI_PROVIDER=kira
QUIZ_AI_MODEL=kira-mini-1.0
QUIZ_AI_API_KEY=your-kira-key
```

Ví dụ giữ Groq cho sơ đồ, dùng ZenMux cho quiz:

```env
AI_PROVIDER=groq
AI_MODEL=qwen/qwen3.6-27b
GROQ_API_KEY=gsk_...

QUIZ_AI_PROVIDER=zenmux
QUIZ_AI_MODEL=z-ai/glm-4.6v-flash-free
QUIZ_AI_API_KEY=your-zenmux-key
```

**Bật Adaptive AI Micro-Quiz Phase 1 (tùy chọn):**

1. Chạy migration `supabase/migrations/20260810120000_adaptive_quiz_phase1.sql` trong Supabase SQL Editor.
2. Lấy server secret key trong Supabase Project Settings và thêm vào `.env.local` dưới tên `SUPABASE_SECRET_KEY`. Có thể dùng `SUPABASE_SERVICE_ROLE_KEY` cũ làm phương án thay thế. Tuyệt đối không thêm prefix `VITE_` cho key này.
3. Đặt cả `VITE_ADAPTIVE_QUIZ_ENABLED=true` và `ADAPTIVE_QUIZ_ENABLED=true`, rồi khởi động lại `npm run dev`.
4. Giáo viên mở bài giảng PDF một lần; hệ thống tự lập `lesson_chunks` độc lập với việc tạo sơ đồ. Kiểm tra số chunk trước khi pilot.

Khi hai flag ở trạng thái `false`, toàn bộ API và giao diện quiz bị vô hiệu hóa; luồng hiện tại không thay đổi. Phase 1 cố định đúng 3 câu, dùng Quizer Agent + Verifier Agent và chỉ truy xuất nội dung trong bài học hiện tại.

**Bật Adaptive Quiz Phase 2 (sau khi Phase 1 đã hoạt động):**

1. Giữ nguyên migration Phase 1 và chạy thêm `supabase/migrations/20260812090000_adaptive_quiz_phase2.sql` một lần trong Supabase SQL Editor.
2. Giữ `VITE_ADAPTIVE_QUIZ_ENABLED=true` và `ADAPTIVE_QUIZ_ENABLED=true`.
3. Đặt thêm `VITE_ADAPTIVE_QUIZ_PHASE2_ENABLED=true` và `ADAPTIVE_QUIZ_PHASE2_ENABLED=true`, rồi khởi động lại `npm run dev`.
4. Học sinh tương tác keyword/đánh dấu slide chưa rõ và có ít nhất thời gian active theo trigger. Thông báo sẽ cho chọn 3 câu, 5 câu hoặc ôn tập 10 câu.

Phase 2 dùng BM25-only, coverage plan deterministic, sinh theo batch tối đa 5 câu và chỉ tạo lại slot bị Verifier từ chối. Quiz đang làm được lưu tiến độ; dashboard giáo viên hiển thị acceptance, completion, điểm, retry và latency. Hai flag Phase 2 là kill switch: chuyển cả hai về `false` sẽ quay lại đúng luồng Phase 1 ba câu mà không cần rollback migration hoặc xóa dữ liệu.

**4. Chạy ứng dụng:**

```bash
npm run dev
```

Mở địa chỉ hiển thị trong terminal (mặc định: [http://localhost:5173](http://localhost:5173))

**5. Thiết lập tài khoản đầu tiên:**

- Đăng ký tài khoản đầu tiên qua giao diện web
- Vào **SQL Editor** của Supabase, chạy lệnh sau để gán quyền admin:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
```

- Đăng xuất và đăng nhập lại
- Admin có thể tạo thêm Teacher và quản lý hệ thống

**6. Thiết lập giáo viên:**

Admin có thể chuyển tài khoản thường thành Teacher từ Admin Dashboard, hoặc chạy SQL:

```sql
UPDATE public.profiles
SET role = 'teacher'
WHERE id = (SELECT id FROM auth.users WHERE email = 'teacher@example.com');
```

### Build Production

```bash
npm run build
npm start
```

Build sẽ tạo bundle tĩnh trong thư mục `dist/`. Cấu hình hiện tại sử dụng `vite-plugin-singlefile` để embed JavaScript và CSS vào `dist/index.html` cho deployment dễ dàng.

## Điều khiển

| Hành động | Cách thao tác |
| --- | --- |
| Xoay góc nhìn | Kéo chuột trên cảnh 3D |
| Phóng to/thu nhỏ | Cuộn chuột |
| Di chuyển camera | Nhấn chuột phải và kéo |
| Mở bài học | Chọn hành tinh hoặc dùng thanh điều hướng dưới cùng |
| Hiện/ẩn quỹ đạo | Chọn nút `◎` |
| Tạm dừng/tiếp tục chuyển động | Chọn nút `Ⅱ` hoặc `▶` |
| Tạo bản đồ trực tiếp | Viết trong panel ghi chú, xem bản đồ tự động cập nhật |
| Lưu bản đồ | Chọn **Save Map** trong toolbar |
| Chuyển lớp học (Student) | Chọn avatar > chọn lớp khác |
| Quản lý khóa học (Teacher) | Vào Teacher Dashboard |
| Quản lý hệ thống (Admin) | Vào Admin Dashboard |

## Cấu trúc dự án

```text
SolarNoteMap/
├── src/
│   ├── components/
│   │   ├── AdminDashboard.tsx       # Quản trị hệ thống
│   │   ├── AuthScreen.tsx           # Màn hình đăng nhập/đăng ký
│   │   ├── ClassroomOnboarding.tsx  # Hướng dẫn tham gia lớp
│   │   ├── CommunityQuestions.tsx   # Hệ thống hỏi đáp
│   │   ├── KnowledgeFlow.tsx        # Bản đồ tri thức React Flow
│   │   ├── LearningConsole.tsx      # Console bài học chính
│   │   ├── LessonSummary.tsx        # Tóm tắt bài học AI
│   │   ├── PdfSlideWorkspace.tsx    # Workspace PDF tương tác
│   │   ├── Planet.tsx               # Hình học và tương tác hành tinh
│   │   ├── SelectablePdfPage.tsx    # Render PDF page
│   │   ├── SlideDiscussion.tsx      # Thảo luận theo slide
│   │   ├── SlideLearningWorkspace.tsx # Workspace slide cơ bản
│   │   ├── SolarSystem.tsx          # Hệ thống hành tinh và quỹ đạo
│   │   ├── SpaceObjects.tsx         # Hiệu ứng không gian sâu
│   │   ├── StudentClassDialog.tsx   # Dialog chuyển lớp
│   │   ├── Sun.tsx                  # Mặt trời và hiệu ứng ánh sáng
│   │   └── TeacherDashboard.tsx     # Dashboard giáo viên
│   ├── data/
│   │   └── lessons.ts               # Dữ liệu bài học mặc định
│   ├── hooks/
│   │   └── useAuth.ts               # Hook xác thực
│   ├── lib/
│   │   └── supabaseClient.ts        # Supabase client config
│   ├── utils/
│   │   ├── cn.ts                    # Utility merge CSS classes
│   │   ├── cloudClassroom.ts        # API lớp học và khóa học
│   │   ├── courseStore.ts           # Quản lý state khóa học
│   │   ├── keywordGlossary.ts       # Xử lý từ điển thuật ngữ
│   │   ├── lessonSession.ts         # Session bài học
│   │   ├── lessonSummary.ts         # Tạo tóm tắt bài học
│   │   ├── lessonVisibility.ts      # Logic hiển thị bài học
│   │   └── pdfLoading.ts            # Preload PDF
│   ├── App.tsx                      # Layout ứng dụng và state cấp cao
│   ├── auth.css                     # Styles đăng nhập
│   ├── index.css                    # Global và responsive styles
│   └── main.tsx                     # React entry point
├── supabase/
│   ├── migrations/                  # Database migrations
│   └── README.md                    # Hướng dẫn setup Supabase
├── shared/
│   └── keywordGlossary.mjs         # Shared glossary logic
├── public/                          # Static assets
├── day01-llm-foundation.pdf        # PDF mẫu bài học 1
├── tu_khoa_AI_LLM_RAG_Agent_MLOps.csv # Từ điển thuật ngữ AI
├── server.mjs                      # Node.js Express server
├── render.yaml                     # Render deployment config
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Lưu trữ dữ liệu

Ứng dụng sử dụng Supabase PostgreSQL với Row Level Security để lưu trữ:

**Bảng chính:**
- `profiles` - Thông tin người dùng (role: admin/teacher/student)
- `courses` - Chương trình khóa học
- `lessons` - Bài học và PDF
- `classrooms` - Lớp học với mã tham gia
- `classroom_lessons` - Lịch phát hành bài học theo lớp
- `classroom_members` - Thành viên lớp học
- `student_activities` - Hoạt động học tập
- `knowledge_maps` - Bản đồ tri thức
- `community_questions` - Hệ thống hỏi đáp
- `lesson_keywords` - Từ điển thuật ngữ bài học
- `student_keyword_access` - Quyền truy cập thuật ngữ

**Storage:**
- Lesson PDFs được lưu trong Supabase Storage bucket `lesson-pdfs`
- PDF URLs có thời hạn (signed URLs) để bảo mật

**Security:**
- Tất cả bảng đều bật Row Level Security (RLS)
- Mã tham gia lớp được hash trước khi lưu
- Failed join attempts bị rate-limit theo tài khoản
- PDFs riêng tư được phân phối qua signed URLs có thời hạn

## Quy trình sử dụng

### Dành cho Admin
1. Đăng nhập với tài khoản admin đã được thiết lập
2. Quản lý tài khoản: chuyển đổi role Student/Teacher, khóa/mở khóa
3. Xem tổng quan courses và classes của toàn hệ thống
4. Admin không thể truy cập ghi chú và bản đồ riêng tư của học viên

### Dành cho Teacher
1. Đăng nhập và vào Teacher Dashboard
2. Tạo Course Program (chương trình khóa học)
3. Thêm bài học:
   - Upload PDF làm tài liệu
   - Hệ thống tự động tạo tóm tắt bằng AI
   - Quản lý từ điển thuật ngữ cho bài học
4. Tạo Class (lớp học):
   - Hệ thống tự động tạo mã tham gia
   - Lên lịch phát hành từng bài học cho lớp
5. Chia sẻ mã lớp với học viên
6. Theo dõi hoạt động học tập trong lớp

### Dành cho Student
1. Đăng ký tài khoản mới
2. Nhập mã lớp để tham gia
3. Chọn lớp đang học (nếu tham gia nhiều lớp)
4. Khám phá hệ thống hành tinh 3D
5. Chọn hành tinh để mở bài học đã phát hành
6. Học với PDF tương tác:
   - Đọc tài liệu, điều hướng trang
   - Viết ghi chú cho từng slide/trang
   - Đánh dấu ghim trên PDF
7. Xây dựng bản đồ tri thức:
   - Ghi chú bằng ngôn ngữ tự nhiên
   - AI tự động tạo khái niệm và mối liên hệ
   - Chỉnh sửa, xác nhận hoặc xóa node
   - Lưu bản đồ khi hoàn thành
8. Tham gia cộng đồng:
   - Đặt câu hỏi liên kết đến slide cụ thể
   - Vote và trả lời câu hỏi của bạn học
   - Xem từ điển thuật ngữ của bài học

## Tùy chỉnh bài học

Để thêm hoặc chỉnh sửa bài học mặc định, cập nhật mảng `LESSONS` trong [src/data/lessons.ts](src/data/lessons.ts):

```ts
{
  id: 'prompt-engineering',
  name: 'Prompt Engineering',
  shortName: 'Prompt Design',
  subtitle: 'Buổi 06 · Tín hiệu điều hướng',
  description: 'Học cách viết hướng dẫn rõ ràng cho mô hình AI.',
  color: '#7dd3fc',
  colors: ['#dbeafe', '#38bdf8', '#164e63'],
}
```

`SolarSystem` tự động tạo hành tinh từ danh sách này, nên bài học mới sẽ tự động xuất hiện trong cả cảnh 3D và thanh điều hướng.

## Hạn chế hiện tại

- Node server có rate limiting cơ bản nhưng chưa có authentication nâng cao cho API endpoints
- Chỉ hỗ trợ định dạng PDF cho tài liệu bài học
- Thanh tiến độ `1 / 5` trong header hiện đang tĩnh
- Hiệu năng phụ thuộc vào khả năng WebGL và GPU của thiết bị
- Chưa có automated tests
- Chưa có chế độ reduced-effects cho thiết bị yếu

## Roadmap

- [ ] Tính toán tiến độ khóa học từ dữ liệu hoàn thành bài học
- [ ] Thêm quiz, flashcard và nhiều learning path
- [ ] Hỗ trợ thêm định dạng tài liệu (video, slides interactives)
- [ ] Notification realtime khi có câu hỏi mới
- [ ] Mobile responsive improvements
- [ ] Export bản đồ tri thức dạng PNG/SVG
- [ ] Chế độ offline với service worker
- [ ] Analytics chi tiết cho giáo viên
- [ ] Automated tests (unit, integration, e2e)
- [ ] Chế độ reduced-effects cho thiết bị yếu
- [ ] Hỗ trợ đa ngôn ngữ (i18n)

## Đóng góp

Fork repository, tạo branch cho thay đổi của bạn, kiểm tra production build và mở pull request:

```bash
git checkout -b feature/ten-tinh-nang
# ... thực hiện thay đổi ...
npm run build
npm start
# Kiểm tra build hoạt động tốt
git commit -m "feat: mô tả tính năng"
git push origin feature/ten-tinh-nang
```

Khi báo cáo bug, vui lòng bao gồm:
- Trình duyệt và phiên bản
- Hệ điều hành
- Các bước tái hiện lỗi
- Screenshot hoặc video (đặc biệt cho UI/3D issues)

## Deployment miễn phí trên Render

Repository này bao gồm `render.yaml` Blueprint cho Render free web service.

**Bước 1:** Push repository lên GitHub hoặc GitLab

**Bước 2:** Tại Render, chọn **New > Blueprint** và kết nối repository

**Bước 3:** Nhập các biến môi trường bí mật:
- `AI_PROVIDER` = `groq`, `openai`, `zenmux` hoặc `kira`
- `AI_MODEL` = model tương ứng với provider
- Key tương ứng: `GROQ_API_KEY`, `OPENAI_API_KEY`, `ZENMUX_API_KEY` hoặc `KIRA_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

**Bước 4:** Tạo Blueprint và đợi build hoàn tất

**Lưu ý:**
- **Không bao giờ** commit file `.env.local` hoặc API keys vào git
- Free Render services sẽ sleep sau một thời gian không có traffic
- Request đầu tiên sau khi sleep có thể mất thời gian khởi động
- Filesystem của free tier là tạm thời; dữ liệu quan trọng phải lưu trong Supabase
- Thiết lập Supabase migrations sau khi deploy bằng cách chạy SQL Editor

## License

Dự án này hiện chưa bao gồm file `LICENSE`. Mọi quyền thuộc về chủ sở hữu repository cho đến khi license được thêm vào.
