import { axiosInstance } from "./axios";

export const getGroupVibesApi = async (groupId) => {
  const res = await axiosInstance.get(`/group-vibes/${groupId}/vibes`);
  return res.data;
};

export const createGroupVibeApi = async (groupId, formData) => {
  const res = await axiosInstance.post(`/group-vibes/${groupId}/vibes`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const getAllGroupVibesSummaryApi = async () => {
  const res = await axiosInstance.get("/group-vibes/summary");
  return res.data;
};

export const viewGroupVibeApi = async (groupId, vibeId) => {
  const res = await axiosInstance.post(`/group-vibes/${groupId}/vibes/${vibeId}/view`);
  return res.data;
};

export const reactToGroupVibeApi = async (groupId, vibeId, reaction) => {
  const res = await axiosInstance.post(`/group-vibes/${groupId}/vibes/${vibeId}/react`, {
    reaction,
  });
  return res.data;
};

export const getGroupVibeViewersApi = async (groupId, vibeId) => {
  const res = await axiosInstance.get(`/group-vibes/${groupId}/vibes/${vibeId}/viewers`);
  return res.data;
};

export const replyToGroupVibeApi = async (groupId, vibeId, text) => {
  const res = await axiosInstance.post(`/group-vibes/${groupId}/vibes/${vibeId}/reply`, {
    text,
  });
  return res.data;
};

export const deleteGroupVibeApi = async (groupId, vibeId) => {
  const res = await axiosInstance.delete(`/group-vibes/${groupId}/vibes/${vibeId}`);
  return res.data;
};

export const getCreatorVibeArchiveApi = async (groupId) => {
  const res = await axiosInstance.get(`/group-vibes/${groupId}/vibes/archive`);
  return res.data;
};

export const updateGroupVibePermissionsApi = async (groupId, payload) => {
  const res = await axiosInstance.put(`/group-vibes/${groupId}/vibe-permissions`, payload);
  return res.data;
};
