// features/natori/constants/works.ts
export type Work = {
  slug: string;
  title: string;
  description: string;
  image: string;           // path under /public
  tags: string[];
  year?: string;
  client?: string;
  vgenLink?: string;       // optional: direct link to VGen listing or profile
  licenseNote?: string;
};

export const allTags = [
  "Illustration",
  "Original Goods Illustration",
  "Pixel Art Icon",
  "Game Character Sprite",
  "Fan Art",
] as const;

export const works: Work[] = [
  {
    slug: "NatoriArt001",
    title: "Natori Art 001",
    description: "",
    image: "/natori/IMG_1546.png",
    tags: ["Original Goods Illustration"],
    year: "2025",
    client: "個人制作",
    licenseNote: "© Natori. All rights reserved."
  },
  {
    slug: "NatoriArt002",
    title: "Natori Art 002",
    description: "",
    image: "/natori/IMG_1611.png",
    tags: ["Original Goods Illustration"],
    year: "2024",
    client: "me-ish",
    licenseNote: "© Natori. All rights reserved."
  },
  {
    slug: "NatoriArt003",
    title: "Natori Art 003",
    description: "",
    image: "/natori/IMG_1625.png",
    tags: ["Original Goods Illustration"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  },
  {
    slug: "NatoriArt004",
    title: "Natori Art 004",
    description: "",
    image: "/natori/イラスト23.png",
    tags: ["Illustration"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  },
  {
    slug: "NatoriArt005",
    title: "Natori Art 005",
    description: "",
    image: "/natori/IMG_2170.png",
    tags: ["Illustration"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  },
    {
    slug: "NatoriArt006",
    title: "Natori Art 006",
    description: "",
    image: "/natori/イラスト3.png",
    tags: ["Original Goods Illustration"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  },
      {
    slug: "NatoriArt007",
    title: "Natori Art 007",
    description: "",
    image: "/natori/イラスト32.png",
    tags: ["Original Goods Illustration"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  },
        {
    slug: "NatoriArt008",
    title: "Natori Art 008",
    description: "",
    image: "/natori/イラスト9リサイズ.jpg",
    tags: ["Original Goods Illustration"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  },
  {
    slug: "NatoriArt009",
    title: "Natori Art 009",
    description: "",
    image: "/natori/イラスト10.png",
    tags: ["Fan Art"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  },
    {
    slug: "NatoriArt010",
    title: "Natori Art 010",
    description: "",
    image: "/natori/イラスト19.jpeg",
    tags: ["Original Goods Illustration"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  },
   {
    slug: "NatoriArt011",
    title: "Natori Art 011",
    description: "",
    image: "/natori/イラスト22_0_0.jpeg",
    tags: ["Fan Art"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  },
   {
    slug: "NatoriArt012",
    title: "Natori Art 012",
    description: "",
    image: "/natori/イラスト26.png",
    tags: ["Fan Art"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  },
   {
    slug: "NatoriArt013",
    title: "Natori Art 013",
    description: "",
    image: "/natori/IMG_3741.jpeg",
    tags: ["Game Character Sprite"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  },
  {
    slug: "NatoriArt014",
    title: "Natori Art 014",
    description: "",
    image: "/natori/イラスト複製.jpeg",
    tags: ["Illustration"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  }, 
  {
    slug: "NatoriArt015",
    title: "Natori Art 015",
    description: "",
    image: "/natori/通販掲載用 (1).png",
    tags: ["Original Goods Illustration"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  },   
  {
    slug: "NatoriArt016",
    title: "Natori Art 016",
    description: "",
    image: "/natori/通販掲載用.png",
    tags: ["Original Goods Illustration"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  },   
  {
    slug: "NatoriArt017",
    title: "Natori Art 017",
    description: "",
    image: "/natori/無題121.jpeg",
    tags: ["Pixel Art Icon"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  },  
  {
    slug: "NatoriArt018",
    title: "Natori Art 018",
    description: "",
    image: "/natori/無題124.jpeg",
    tags: ["Pixel Art Icon"],
    year: "2023",
    client: "個人依頼",
    licenseNote: "© Natori. All rights reserved."
  },  
  
];
