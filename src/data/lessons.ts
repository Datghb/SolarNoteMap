export interface Lesson {
  id: string;
  name: string;
  shortName: string;
  subtitle: string;
  description: string;
  prompt: string;
  color: string;
  colors: string[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'ai-foundations',
    name: 'AI là gì?',
    shortName: 'AI Foundations',
    subtitle: 'Buổi 01 · Khởi hành',
    description: 'Nhận diện AI trong đời sống và phân biệt AI với phần mềm thông thường.',
    prompt: 'AI giải quyết vấn đề gì, học từ đâu và tạo ra kết quả như thế nào?',
    color: '#ffb547',
    colors: ['#ffe08a', '#ff9d3d', '#7c3118'],
  },
  {
    id: 'machine-learning',
    name: 'Machine Learning cơ bản',
    shortName: 'Machine Learning',
    subtitle: 'Buổi 02 · Quỹ đạo dữ liệu',
    description: 'Hiểu cách máy học từ ví dụ thay vì chỉ làm theo các quy tắc cố định.',
    prompt: 'Dữ liệu, mô hình, huấn luyện và dự đoán liên hệ với nhau ra sao?',
    color: '#47d7ff',
    colors: ['#b9f4ff', '#2db9df', '#145078'],
  },
  {
    id: 'data-features',
    name: 'Dữ liệu và đặc trưng',
    shortName: 'Data & Features',
    subtitle: 'Buổi 03 · Nhiên liệu AI',
    description: 'Khám phá vai trò của dữ liệu sạch và cách biểu diễn đặc trưng cho mô hình.',
    prompt: 'Một bộ dữ liệu tốt cần gì và đặc trưng nào quyết định chất lượng dự đoán?',
    color: '#7ee787',
    colors: ['#c7ffd0', '#46b968', '#145b39'],
  },
  {
    id: 'learning-types',
    name: 'Supervised & Unsupervised',
    shortName: 'Learning Types',
    subtitle: 'Buổi 04 · Hai thiên hà',
    description: 'So sánh học có giám sát và không giám sát qua các tình huống thực tế.',
    prompt: 'Khi nào cần nhãn, khi nào để máy tự tìm cấu trúc và mỗi cách cho kết quả gì?',
    color: '#ff6b9d',
    colors: ['#ffc0d5', '#e84e86', '#721b48'],
  },
  {
    id: 'neural-networks',
    name: 'Neural Network nhập môn',
    shortName: 'Neural Networks',
    subtitle: 'Buổi 05 · Mạng lưới sao',
    description: 'Làm quen neuron, layer và cách mạng nơ-ron biến đổi thông tin.',
    prompt: 'Tín hiệu đi qua các layer như thế nào và mạng học bằng cách điều chỉnh điều gì?',
    color: '#b69cff',
    colors: ['#e4dbff', '#9d7bea', '#4b2d88'],
  },
];
