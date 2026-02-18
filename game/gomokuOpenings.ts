import { Hex } from '../types';

export interface OpeningInfo {
  name: string;
  pinyin: string;
  status: 'Black Win' | 'White Win' | 'Balance';
  description: string;
  keyPoints?: {q: number, r: number, desc?: string}[]; 
}

// 26 Renju Openings
const OPENINGS: Record<string, OpeningInfo> = {
  // Direct Openings
  'D_0,1': { 
      name: '寒星', pinyin: 'Han Xing', status: 'Black Win', 
      description: '黑方必胜。变化较少，黑方容易控制局势。',
      keyPoints: [{q:0, r:2}, {q:-1, r:2}, {q:-1, r:0}]
  },
  'D_0,2': { 
      name: '溪月', pinyin: 'Xi Yue', status: 'Black Win', 
      description: '黑方必胜。也是常见的必胜开局之一。',
      keyPoints: [{q:0, r:1}, {q:-1, r:1}, {q:-1, r:0}]
  },
  'D_-1,1': { name: '疏星', pinyin: 'Shu Xing', status: 'Balance', description: '局面平衡。' },
  'D_-1,2': { 
      name: '花月', pinyin: 'Hua Yue', status: 'Black Win', 
      description: '黑方必胜！五子棋最强开局。',
      keyPoints: [{q:1, r:-1}, {q:-1, r:1}, {q:-2, r:2}, {q:0, r:1}]
  },
  'D_-2,2': { name: '残月', pinyin: 'Can Yue', status: 'Black Win', description: '黑方必胜。' },
  'D_-2,1': { name: '雨月', pinyin: 'Yu Yue', status: 'Black Win', description: '黑方必胜。' },
  'D_-2,0': { name: '金星', pinyin: 'Jin Xing', status: 'Black Win', description: '黑方必胜。' },
  'D_-2,-1': { name: '松月', pinyin: 'Song Yue', status: 'Black Win', description: '黑方必胜。' },
  'D_-1,-1': { name: '丘月', pinyin: 'Qiu Yue', status: 'Balance', description: '局面平衡。' },
  'D_-1,-2': { name: '新月', pinyin: 'Xin Yue', status: 'Black Win', description: '黑方必胜。' },
  'D_0,-2': { name: '瑞星', pinyin: 'Rui Xing', status: 'Balance', description: '平衡局面。' },
  'D_1,-2': { name: '山月', pinyin: 'Shan Yue', status: 'Black Win', description: '黑方必胜。' },
  'D_1,-1': { name: '游星', pinyin: 'You Xing', status: 'White Win', description: '白方必胜（黑方必败）。' },
  
  // Indirect Openings
  'I_0,1': { name: '长星', pinyin: 'Chang Xing', status: 'White Win', description: '白方大优。' },
  'I_0,2': { name: '峡月', pinyin: 'Xia Yue', status: 'Black Win', description: '黑方必胜。' },
  'I_1,2': { name: '恒星', pinyin: 'Heng Xing', status: 'Black Win', description: '黑方必胜。' },
  'I_1,1': { name: '水月', pinyin: 'Shui Yue', status: 'Black Win', description: '黑方必胜。' },
  'I_2,1': { name: '流星', pinyin: 'Liu Xing', status: 'White Win', description: '白方必胜。' },
  'I_2,0': { name: '云月', pinyin: 'Yun Yue', status: 'Black Win', description: '黑方必胜。' },
  'I_2,-1': { 
      name: '浦月', pinyin: 'Pu Yue', status: 'Black Win', 
      description: '黑方必胜！与花月并称两大必胜神局。',
      keyPoints: [{q:1, r:1}, {q:0, r:1}, {q:1, r:0}]
  },
  'I_1,-1': { name: '岚月', pinyin: 'Lan Yue', status: 'Black Win', description: '黑方必胜。' },
  'I_1,-2': { name: '银月', pinyin: 'Yin Yue', status: 'Black Win', description: '黑方必胜。' },
  'I_0,-2': { name: '明星', pinyin: 'Ming Xing', status: 'Black Win', description: '黑方必胜。' },
  'I_-1,-2': { name: '斜月', pinyin: 'Xie Yue', status: 'Balance', description: '平衡。' },
  'I_-1,-1': { name: '名月', pinyin: 'Ming Yue', status: 'Black Win', description: '黑方必胜。' },
  'I_-1,1': { name: '慧星', pinyin: 'Hui Xing', status: 'White Win', description: '白方必胜。' },
};

// Forward transforms
const transforms: Array<(x:number, y:number)=>[number,number]> = [
    (x, y) => [x, y],
    (x, y) => [-x, y],
    (x, y) => [x, -y],
    (x, y) => [-x, -y],
    (x, y) => [y, x],
    (x, y) => [-y, x],
    (x, y) => [y, -x],
    (x, y) => [-y, -x],
];

// Inverse transforms
const inverseTransforms: Array<(x:number, y:number)=>[number,number]> = [
    (u, v) => [u, v],
    (u, v) => [-u, v],
    (u, v) => [u, -v],
    (u, v) => [-u, -v],
    (u, v) => [v, u],
    (u, v) => [v, -u],
    (u, v) => [-v, u],
    (u, v) => [-v, -u],
];

export const detectOpening = (moves: Hex[]): { info: OpeningInfo, transform: (q:number, r:number)=>[number,number] } | null => {
  if (moves.length < 3) return null;

  const m1 = moves[0];
  const m2 = moves[1];
  const m3 = moves[2];

  if (m1.q !== 7 || m1.r !== 7) return null;

  const dx2 = m2.q - m1.q;
  const dy2 = m2.r - m1.r;
  const dx3 = m3.q - m1.q;
  const dy3 = m3.r - m1.r;

  for (let i = 0; i < transforms.length; i++) {
    const t = transforms[i];
    const [tx2, ty2] = t(dx2, dy2);
    
    // Check Indirect (0,1)
    if (tx2 === 0 && ty2 === 1) {
      const [tx3, ty3] = t(dx3, dy3);
      const key = `I_${tx3},${ty3}`;
      if (OPENINGS[key]) return { info: OPENINGS[key], transform: inverseTransforms[i] };
    }
    
    // Check Direct (1,1)
    if (tx2 === 1 && ty2 === 1) {
      const [tx3, ty3] = t(dx3, dy3);
      const key = `D_${tx3},${ty3}`;
      if (OPENINGS[key]) return { info: OPENINGS[key], transform: inverseTransforms[i] };
    }
  }

  return null;
};