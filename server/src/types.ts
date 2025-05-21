// Базовый элемент списка (число от 1 до 1 000 000)
export interface Item {
  id: number;
  value: number;
}

// Состояние пользователя - выбранные элементы и порядок отображения
export interface UserState {
  selectedIds: number[];   // ID выбранных элементов
  customOrder: number[];   // Пользовательский порядок элементов (ID)
}

// Параметры запроса для получения элементов
export interface FetchItemsParams {
  page: number;            // Номер страницы (начиная с 0)
  limit: number;           // Количество элементов на страницу
  search?: string;         // Строка поиска
}

// Ответ API с элементами
export interface ItemsResponse {
  items: Item[];           // Элементы страницы
  total: number;           // Общее количество элементов (с учетом фильтрации)
  hasMore: boolean;        // Есть ли еще элементы
} 