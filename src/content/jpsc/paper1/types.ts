export interface JPSCQuestionRaw {
  subjectSlug: string;
  topicSlug: string;
  questionText: string;
  options: [string, string, string, string];
  correctAnswerIndex: number;
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questionType: 'PYQ' | 'PYQ_INSPIRED' | 'PRACTICE' | 'CURRENT_AFFAIRS' | 'SAMPLE_PAPER';
  sourceType: 'OFFICIAL_PYQ' | 'INTERNAL' | 'REFERENCE_BOOK';
  year?: number;
  sourceDate?: string;
  qaStatus: 'VERIFIED';
}
