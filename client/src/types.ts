// Элемент списка 
export interface Item {
  id: number;
  value: number;
}

// Состояние пользователя
export interface UserState {
  selectedIds: number[];   // ID выбранных элементов
  customOrder: number[];   // Пользовательский порядок элементов (ID) после drag-n-drop
}

// Ответ API с элементами
export interface ItemsResponse {
  items: Item[];           // Элементы страницы
  total: number;           // Общее количество элементов (с учетом фильтрации)
  hasMore: boolean;        // Есть ли еще элементы
} 