// src/lib/aura/studio/skillPresets.ts

export type SkillCategory = {
  label: string;
  emoji: string;
  skills: string[];
};

export const SKILL_PRESET_CATEGORIES: SkillCategory[] = [
  {
    label: 'デザイン',
    emoji: '🎨',
    skills: [
      'Figma', 'Illustrator', 'Photoshop', 'XD', 'InDesign',
      'Sketch', 'Canva', 'After Effects', 'Premiere Pro', 'Blender',
    ],
  },
  {
    label: 'イラスト',
    emoji: '🖌️',
    skills: [
      'CLIP STUDIO PAINT', 'Procreate', 'SAI', 'ibis Paint', 'Krita',
      'メディバンペイント',
    ],
  },
  {
    label: 'コーディング',
    emoji: '💻',
    skills: [
      'HTML/CSS', 'JavaScript', 'TypeScript', 'React', 'Next.js',
      'Vue.js', 'Python', 'PHP', 'WordPress', 'Shopify',
    ],
  },
  {
    label: '写真・映像',
    emoji: '📸',
    skills: [
      'Lightroom', 'DaVinci Resolve', 'Final Cut Pro', 'Premiere Pro',
      '撮影・ディレクション',
    ],
  },
  {
    label: '音楽・音響',
    emoji: '🎵',
    skills: [
      'Logic Pro', 'Ableton Live', 'GarageBand', 'FL Studio', 'Pro Tools',
      '作曲', 'ミックス・マスタリング',
    ],
  },
  {
    label: 'ライティング',
    emoji: '✍️',
    skills: [
      'コピーライティング', 'SEO', '取材・インタビュー',
      'シナリオ', 'Webライティング',
    ],
  },
  {
    label: 'その他',
    emoji: '🛠️',
    skills: [
      'Notion', 'Excel', 'PowerPoint', 'Slack', 'ChatGPT活用',
      'プロジェクト管理', 'ディレクション',
    ],
  },
];

export const TAGLINE_EXAMPLES = [
  'ビジュアルで世界を豊かに',
  '色と線が語る、あなたの物語',
  '手を動かし、想いを形に',
  'デザインで、伝える力を',
  '見た目と伝わり方、両方整える',
  '「好き」を仕事にする',
  'アイデアを、届く形に変える',
];
