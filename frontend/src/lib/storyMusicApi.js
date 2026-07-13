import { axiosInstance } from "./axios";

export async function searchStoryMusicApi(query, { signal } = {}) {
  const res = await axiosInstance.get("/music/search", {
    params: { q: query },
    timeout: 35000,
    signal,
  });
  return res.data;
}

export async function fetchTrendingMusicApi() {
  const res = await axiosInstance.get("/music/trending", { timeout: 90000 });
  return res.data;
}

export async function parseStoryMusicApi(link) {
  const res = await axiosInstance.post(
    "/music/parse",
    { link },
    { timeout: 60000 }
  );
  return res.data;
}
