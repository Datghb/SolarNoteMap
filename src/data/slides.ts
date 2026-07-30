export interface LessonSlide {
  id: string;
  eyebrow: string;
  title: string;
  statement: string;
  points: { id: string; label: string; description: string }[];
  question: string;
}

export function getPdfPageSlides(pageCount: number): LessonSlide[] {
  return Array.from({ length: pageCount }, (_, index) => ({
    id: `pdf-page-${index + 1}`,
    eyebrow: 'AI & LLM Foundation',
    title: `Trang ${index + 1}`,
    statement: 'Nội dung từ tài liệu bài giảng Day 01.',
    points: [],
    question: `Bạn hiểu hoặc còn thắc mắc điều gì ở trang ${index + 1}?`,
  }));
}

const SLIDE_CONTENT: Record<string, LessonSlide[]> = {
  'ai-foundations': [
    { id: 'ai-around-us', eyebrow: 'Khởi động', title: 'AI đang ở quanh chúng ta', statement: 'AI không chỉ là robot. Nó xuất hiện trong những hệ thống biết nhận diện, dự đoán hoặc đề xuất.', points: [
      { id: 'recognize', label: 'Nhận diện', description: 'Phát hiện khuôn mặt, giọng nói hoặc vật thể.' },
      { id: 'predict', label: 'Dự đoán', description: 'Ước lượng kết quả từ những mẫu đã học.' },
      { id: 'recommend', label: 'Đề xuất', description: 'Chọn nội dung phù hợp với từng người.' },
    ], question: 'Ứng dụng nào bạn dùng hôm nay có thể đang sử dụng AI?' },
    { id: 'learning-loop', eyebrow: 'Khái niệm chính', title: 'AI học từ dữ liệu như thế nào?', statement: 'Dữ liệu cung cấp ví dụ, quá trình huấn luyện tìm quy luật và mô hình sử dụng quy luật đó cho đầu vào mới.', points: [
      { id: 'data', label: '01 · Dữ liệu', description: 'Những ví dụ hoặc quan sát ban đầu.' },
      { id: 'training', label: '02 · Huấn luyện', description: 'Quá trình điều chỉnh để giảm sai số.' },
      { id: 'model', label: '03 · Mô hình', description: 'Cấu trúc đã học dùng để dự đoán.' },
    ], question: 'Điều gì có thể xảy ra nếu dữ liệu học không đại diện?' },
    { id: 'ai-vs-rules', eyebrow: 'So sánh', title: 'AI khác phần mềm theo luật', statement: 'Phần mềm truyền thống làm theo quy tắc được viết sẵn; AI có thể học quy luật từ nhiều ví dụ.', points: [
      { id: 'rules', label: 'Quy tắc cố định', description: 'Nếu A xảy ra thì thực hiện B.' },
      { id: 'patterns', label: 'Mẫu học được', description: 'Tìm mối liên hệ trong dữ liệu.' },
      { id: 'uncertainty', label: 'Có độ bất định', description: 'Kết quả AI có thể đúng hoặc sai.' },
    ], question: 'Máy tính bỏ túi có phải là AI không? Vì sao?' },
    { id: 'responsible-ai', eyebrow: 'Phản tư', title: 'AI cần con người kiểm soát', statement: 'Một hệ thống hữu ích không chỉ cần chính xác mà còn phải minh bạch, công bằng và được sử dụng đúng mục đích.', points: [
      { id: 'bias', label: 'Sai lệch', description: 'Dữ liệu lệch có thể tạo kết quả thiếu công bằng.' },
      { id: 'privacy', label: 'Riêng tư', description: 'Dữ liệu cá nhân cần được bảo vệ.' },
      { id: 'oversight', label: 'Giám sát', description: 'Con người chịu trách nhiệm cho quyết định cuối.' },
    ], question: 'Quyết định nào không nên giao hoàn toàn cho AI?' },
  ],
};

export function getLessonSlides(lessonId: string, lessonName: string): LessonSlide[] {
  return SLIDE_CONTENT[lessonId] ?? [
    { id: `${lessonId}-overview`, eyebrow: 'Khởi động', title: lessonName, statement: `Bắt đầu bằng việc xác định những khái niệm quan trọng nhất trong “${lessonName}”.`, points: [
      { id: 'concept', label: 'Khái niệm', description: 'Ghi lại định nghĩa bằng lời của bạn.' },
      { id: 'connection', label: 'Mối liên hệ', description: 'Tìm điều liên kết các ý với nhau.' },
      { id: 'example', label: 'Ví dụ', description: 'Dùng một tình huống thực tế để kiểm chứng.' },
    ], question: 'Bạn đã hiểu những ý chính nào và còn muốn tìm hiểu thêm điều gì?' },
    { id: `${lessonId}-mechanism`, eyebrow: 'Khám phá', title: 'Từ khái niệm đến cơ chế', statement: 'Một khái niệm chỉ thực sự rõ khi bạn giải thích được đầu vào, quá trình và kết quả của nó.', points: [
      { id: 'input', label: 'Đầu vào', description: 'Điều gì cung cấp thông tin cho hệ thống?' },
      { id: 'process', label: 'Quá trình', description: 'Thông tin được biến đổi như thế nào?' },
      { id: 'output', label: 'Kết quả', description: 'Hệ thống tạo ra điều gì và cho ai?' },
    ], question: 'Bạn có thể mô tả cơ chế này mà không dùng lại nguyên văn bài giảng không?' },
    { id: `${lessonId}-reflection`, eyebrow: 'Phản tư', title: 'Kiểm tra cách hiểu của bạn', statement: 'Kết nối kiến thức với một ví dụ và nhận diện giới hạn là cách biến thông tin thành hiểu biết.', points: [
      { id: 'application', label: 'Ứng dụng', description: 'Tìm một tình huống có thể áp dụng kiến thức.' },
      { id: 'limitation', label: 'Giới hạn', description: 'Khi nào cách tiếp cận này có thể thất bại?' },
      { id: 'question', label: 'Câu hỏi mới', description: 'Điều gì bạn vẫn chưa thể giải thích?' },
    ], question: 'Sau bài học, câu hỏi quan trọng nhất bạn muốn tìm hiểu tiếp là gì?' },
  ];
}
