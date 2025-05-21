import { Item, UserState, FetchItemsParams, ItemsResponse } from './types';

// Создаем 1 000 000 элементов (числа от 1 до 1 000 000)
export const generateItems = (): Item[] => {
  const items: Item[] = [];
  for (let i = 1; i <= 1000000; i++) {
    items.push({ id: i, value: i });
  }
  return items;
};

// Все элементы храним в памяти
const items = generateItems();

// Состояние пользователя (выбранные элементы и их порядок)
// В реальном приложении это могло бы храниться в базе данных или Redis по sessionId
let userState: UserState = {
  selectedIds: [],
  customOrder: []
};

// Получить текущее состояние пользователя
export const getUserState = (): UserState => {
  return { ...userState };
};

// Обновить состояние пользователя
export const updateUserState = (newState: UserState): UserState => {
  userState = {
    selectedIds: [...newState.selectedIds],
    customOrder: [...newState.customOrder]
  };
  return getUserState();
};

// Получить отфильтрованные элементы с пагинацией
export const getFilteredItems = (params: FetchItemsParams): ItemsResponse => {
  const { page, limit, search } = params;
  
  // Фильтрация по поиску, если задан
  const filteredItems = search
    ? items.filter(item => item.value.toString().includes(search))
    : items;
  
  // Применение пользовательского порядка
  let orderedItems = [...filteredItems];
  
  if (userState.customOrder.length > 0) {
    // Создаем карту с индексами сортировки
    const orderMap = new Map<number, number>();
    userState.customOrder.forEach((id, index) => {
      orderMap.set(id, index);
    });
    
    // Сначала показываем элементы из пользовательской сортировки
    orderedItems.sort((a, b) => {
      const aOrder = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const bOrder = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
      
      // Если оба элемента в пользовательском порядке, сортируем по нему
      if (aOrder !== Number.MAX_SAFE_INTEGER && bOrder !== Number.MAX_SAFE_INTEGER) {
        return aOrder - bOrder;
      }
      
      // Если только один элемент в пользовательском порядке, он идет первым
      if (aOrder !== Number.MAX_SAFE_INTEGER) return -1;
      if (bOrder !== Number.MAX_SAFE_INTEGER) return 1;
      
      // Если ни один не в пользовательском порядке, сортируем по id
      return a.id - b.id;
    });
  }
  
  // Применяем пагинацию
  const startIndex = page * limit;
  const endIndex = startIndex + limit;
  const paginatedItems = orderedItems.slice(startIndex, endIndex);
  
  return {
    items: paginatedItems,
    total: filteredItems.length,
    hasMore: endIndex < filteredItems.length
  };
}; 