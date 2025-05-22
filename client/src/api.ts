import axios from 'axios';
import type { ItemsResponse, UserState } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Получить элементы с пагинацией и фильтрацией
export const fetchItems = async (
  page: number = 0,
  limit: number = 20,
  search?: string,
  signal?: AbortSignal
): Promise<ItemsResponse> => {
  const params = { page, limit, search };
  const response = await api.get<ItemsResponse>('/items', { 
    params,
    signal 
  });
  return response.data;
};

// Получить текущее состояние пользователя
export const fetchUserState = async (): Promise<UserState> => {
  const response = await api.get<UserState>('/state');
  return response.data;
};

// Сохранить состояние пользователя
export const saveUserState = async (state: UserState): Promise<UserState> => {
  const response = await api.post<UserState>('/state', state);
  return response.data;
};

// Удалить элемент по id
export const deleteItem = async (id: number): Promise<void> => {
  await api.delete(`/items/${id}`);
}; 