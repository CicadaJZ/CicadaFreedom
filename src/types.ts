import { Coffee } from "lucide-react";

export type Channel = "all" | "work" | "school" | "meme" | "quote" | "joke";

export type Post = {
  id: number;
  author: string;
  role: string;
  channel: Exclude<Channel, "all">;
  content: string;
  likes: number;
  comments: number;
  mood: string;
  time: string;
  isMeme?: boolean;
  status: "published" | "hidden";
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
  memePosts: number;
  newestPostAt: string | null;
  channels: Array<{ channel: Exclude<Channel, "all">; count: number }>;
};
