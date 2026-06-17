import { Coffee } from "lucide-react";

export type Channel = "all" | "work" | "school" | "meme" | "quote" | "joke";

export type Post = {
  id: number;
  author: string;
  role: string;
  channel: Exclude<Channel, "all">;
  content: string;
  likes: number;
  likedBy: string[];
  comments: PostComment[];
  commentCount: number;
  tags: string[];
  mood: string;
  time: string;
  isMeme?: boolean;
  imageUrl?: string;
  status: "published" | "hidden";
  createdAt: string;
};

export type PostComment = {
  id: number;
  userId?: string;
  author: string;
  avatar: string;
  content: string;
  createdAt: string;
  replies: PostComment[];
};

export type Tag = {
  id: string;
  label: string;
  createdAt: string;
};

export type UploadAsset = {
  id: number;
  fileName: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type DailyLifeRecord = {
  id: number;
  key: string;
  userId: number;
  nickname: string;
  date: string;
  points: number;
  createdAt: string;
};

export type Level = {
  min: number;
  title: string;
  icon: typeof Coffee;
  tone: string;
};

export type UserProfile = {
  id?: number;
  email: string;
  nickname: string;
  avatar: string;
  avatarType: "preset" | "upload";
  isGuest: boolean;
  points: number;
};

export type AdminStats = {
  users: number;
  posts: number;
  published: number;
  hidden: number;
  totalLikes: number;
  totalComments: number;
  memePosts: number;
  uploads: number;
  tags: number;
  dailyLifeRecords: number;
  newestPostAt: string | null;
  channels: Array<{ channel: Exclude<Channel, "all">; count: number }>;
};
