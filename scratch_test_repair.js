import { buildPromptA } from './server/prompts/promptA.js';
import { validateStoryboard } from './server/services/validator.js';
import { repairAndEnsureScenes } from './server/routes/generate.js';

console.log('Testing Prompt A schema and repair logic...');
const sampleUnderScenes = {
  title: 'Introduction to Tokenization',
  language: 'Hinglish',
  level: 'Beginner',
  scenes: [
    {
      id: 1,
      heading: 'What is Tokenization?',
      bullets: ['Splitting text into chunks', 'Tokens can be words or subwords'],
      narration: 'Tokenization basically means sentences ko chhote tukdo me todna taaki computer samajh sake.',
      visual_hint: 'Text breaking into blocks',
      exam_tag: '2-mark definition',
      checkpoint: {
        q: 'What is tokenization?',
        options: ['Breaking text into pieces', 'Deleting data', 'Compiling code', 'Encrypting passwords'],
        answer: 0
      }
    },
    {
      id: 2,
      heading: 'Types of Tokens',
      bullets: ['Word tokens', 'Character tokens', 'Subword tokens like BPE'],
      narration: 'Tokens alag alag level par bante hain jaise words, characters ya subwords.',
      visual_hint: 'Diagram of token types',
      exam_tag: 'conceptual',
      checkpoint: {
        q: 'Which of these is a token type?',
        options: ['Subword', 'Network packet', 'Database query', 'RAM address'],
        answer: 0
      }
    },
    {
      id: 3,
      heading: 'Why LLMs need Tokens',
      bullets: ['Neural networks understand numbers', 'Tokens are converted to embeddings'],
      narration: 'Models text direct nahi samajhte, pehle tokens bante hain fir numbers.',
      visual_hint: 'Word to token to vector',
      exam_tag: '5-mark diagram',
      checkpoint: {
        q: 'Why do models tokenize text?',
        options: ['To map text to numbers', 'To format hard drive', 'To send emails', 'To play music'],
        answer: 0
      }
    }
  ]
};

console.log('Raw sample scenes:', sampleUnderScenes.scenes.length);
const rawValidation = validateStoryboard(sampleUnderScenes);
console.log('Raw validation valid:', rawValidation.valid, 'compliance:', rawValidation.complianceScore, 'errors:', rawValidation.errors);

const repaired = repairAndEnsureScenes(sampleUnderScenes, 'Tokenization', 'Beginner', 'Hinglish');
console.log('Repaired scenes count:', repaired.scenes.length);
const repairedValidation = validateStoryboard(repaired);
console.log('Repaired validation valid:', repairedValidation.valid, 'compliance:', repairedValidation.complianceScore, 'errors:', repairedValidation.errors);
