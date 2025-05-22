import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { FixedSizeList as List } from 'react-window';
import type { Item } from '../types';
import { fetchItems, fetchUserState, saveUserState, deleteItem } from '../api';
import './ItemList.css';

// Количество элементов для загрузки за один раз
const PAGE_SIZE = 20;

// Высота строки списка
const ROW_HEIGHT = 40;

// Хук для debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Компонент для списка/таблицы элементов
export const ItemList: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [customOrder, setCustomOrder] = useState<number[]>([]);
  
  const getInitialSearch = () => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('searchQuery');
      return saved !== null ? saved : '';
    }
    return '';
  };
  const [search, setSearch] = useState<string>(getInitialSearch);
  
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [filterStates, setFilterStates] = useState<Record<string, {items: Item[], page: number}>>({});

  // Используем debounce для поисковых запросов
  const debouncedSearch = useDebounce(search, 300);
  const prevSearchRef = useRef(search);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Функция для debounce сохранения состояния
  const saveStateDebounced = useRef(setTimeout(() => {}, 0));
  const saveStateWithDebounce = (state: { selectedIds: number[], customOrder: number[] }) => {
    clearTimeout(saveStateDebounced.current);
    saveStateDebounced.current = setTimeout(async () => {
      try {
        await saveUserState(state);
      } catch (error) {
        setError('Не удалось сохранить состояние. Пожалуйста, попробуйте еще раз.');
        console.error('Ошибка при сохранении состояния:', error);
      }
    }, 500);
  };

  // Загрузка состояния пользователя (выбранные элементы и сортировка)
  const loadUserState = useCallback(async () => {
    try {
      setError(null);
      const state = await fetchUserState();
      setSelectedIds(new Set(state.selectedIds));
      setCustomOrder(state.customOrder);
    } catch (err: unknown) {
      setError('Не удалось загрузить пользовательские настройки');
      setSelectedIds(new Set());
      setCustomOrder([]);
      console.error('Ошибка при загрузке пользовательского состояния:', err);
    }
  }, []);

  // Загрузка элементов с пагинацией и поддержкой поиска
  const loadItems = useCallback(async (reset: boolean = false) => {
    // Отменяем предыдущий запрос, если он существует
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const loadingType = reset 
      ? (debouncedSearch ? setIsSearching : setIsInitialLoading) 
      : setIsLoadingMore;
    
    try {
      loadingType(true);
      setLoading(true);
      setError(null);
      
      const currentPage = reset ? 0 : page;
      
      // Проверяем кэш для текущего поиска, если сбрасываем страницу
      const cacheKey = debouncedSearch || 'all';
      if (reset && filterStates[cacheKey] && !isSearching) {
        const cachedState = filterStates[cacheKey];
        setItems(cachedState.items);
        setPage(cachedState.page);
        loadingType(false);
        setLoading(false);
        return;
      }
      
      const result = await fetchItems(currentPage, PAGE_SIZE, debouncedSearch, controller.signal);
      
      if (!controller.signal.aborted) {
        const newItems = reset ? result.items : [...items, ...result.items];
        setItems(newItems);
        setTotal(result.total);
        setHasMore(result.hasMore);
        
        const newPage = reset ? 1 : currentPage + 1;
        setPage(newPage);
        
        // Проверка актуальности customOrder. selectedIds теперь не фильтруем здесь,
        // чтобы выбор сохранялся независимо от текущего фильтра.
        if (customOrder.length > 0) {
          const allLoadedIds = new Set(newItems.map(item => item.id));
          const filteredCustomOrder = customOrder.filter(id => allLoadedIds.has(id));
          
          if (filteredCustomOrder.length !== customOrder.length) {
            setCustomOrder(filteredCustomOrder);
            // selectedIds не изменяем, отправляем текущие
            saveUserState({
              selectedIds: Array.from(selectedIds), // Отправляем все selectedIds
              customOrder: filteredCustomOrder
            });
          }
        }
        
        // Кэшируем результаты
        if (result.items.length > 0) {
          setFilterStates(prev => ({
            ...prev,
            [cacheKey]: { 
              items: reset ? result.items : [...(prev[cacheKey]?.items || []), ...result.items],
              page: newPage
            }
          }));
        }
      }
    } catch (err) {
      // axios отменяет запрос с ошибкой CanceledError, fetch — с AbortError
      if (
        (err instanceof Error && err.name === 'CanceledError') ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        // Не логируем и не показываем пользователю
        return;
      }
      console.error('Ошибка при загрузке элементов:', err);
      setError('Не удалось загрузить данные. Пожалуйста, попробуйте еще раз.');
    } finally {
      if (!controller.signal.aborted) {
        loadingType(false);
        setLoading(false);
      }
    }
  }, [page, debouncedSearch, filterStates, isSearching, items, customOrder, selectedIds]);

  // Сохраняем search в localStorage при изменении
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('searchQuery', search);
    }
  }, [search]);

  // Инициализация: сначала userState, потом первая страница
  useEffect(() => {
    const init = async () => {
      setIsInitialLoading(true);
      await loadUserState();
      // Загружаем элементы. Так как search уже инициализирован из localStorage,
      // debouncedSearch будет содержать корректное значение для первого loadItems.
      await loadItems(true);
      setIsInitialLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Убрали isSearchRestored из зависимостей, т.к. search инициализирован сразу

  // Поиск с учетом debounce
  useEffect(() => {
    if (debouncedSearch !== undefined && prevSearchRef.current !== debouncedSearch) {
      loadItems(true);
      prevSearchRef.current = debouncedSearch;
    }
  }, [debouncedSearch, loadItems]);

  // Обработка скролла для бесконечной загрузки
  const handleScroll = useCallback(({ scrollOffset, scrollDirection }: { scrollOffset: number, scrollDirection: string }) => {
    if (scrollDirection === 'forward' && !loading && !isLoadingMore && hasMore) {
      const scrollThreshold = items.length * ROW_HEIGHT - 800;
      if (scrollOffset > scrollThreshold) {
        setIsLoadingMore(true);
        loadItems();
      }
    }
  }, [loading, isLoadingMore, hasMore, items.length, loadItems]);

  // Обработка выбора элемента (чекбокс)
  const handleSelect = useCallback(async (itemId: number) => {
    if (loading) return;
    
    setError(null);
    const newSet = new Set(selectedIds);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedIds(newSet);
    
    // Используем debounce для сохранения
    saveStateWithDebounce({ 
      selectedIds: Array.from(newSet), 
      customOrder 
    });
  }, [loading, selectedIds, customOrder]);

  // Множественный выбор (чекбоксы в шапке)
  const handleSelectAll = useCallback(async () => {
    if (loading) return;
    
    setError(null);
    let newSet: Set<number>;
    if (selectedIds.size === items.length) {
      newSet = new Set();
    } else {
      newSet = new Set<number>();
      items.forEach(item => newSet.add(item.id));
    }
    setSelectedIds(newSet);
    
    // Используем debounce для сохранения
    saveStateWithDebounce({ 
      selectedIds: Array.from(newSet), 
      customOrder 
    });
  }, [loading, selectedIds, items, customOrder]);

  // Обработка изменения сортировки (drag&drop)
  const handleDragEnd = useCallback(async (result: DropResult) => {
    setDraggingId(null);
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    if (sourceIndex === destIndex) return;
    
    setError(null);
    const newItems = [...items];
    const [moved] = newItems.splice(sourceIndex, 1);
    newItems.splice(destIndex, 0, moved);
    setItems(newItems);
    
    const newOrder = newItems.map(item => item.id);
    setCustomOrder(newOrder);
    
    // Обновляем кэш для текущего фильтра
    const cacheKey = debouncedSearch || 'all';
    setFilterStates(prev => ({
      ...prev,
      [cacheKey]: { 
        items: newItems,
        page: page
      }
    }));
    
    // Используем debounce для сохранения
    saveStateWithDebounce({ 
      selectedIds: Array.from(selectedIds), 
      customOrder: newOrder 
    });
  }, [items, selectedIds, page, debouncedSearch]);

  // Сброс состояния
  const handleReset = useCallback(async () => {
    setError(null);
    
    // Отменяем текущий запрос, если есть
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setSelectedIds(new Set());
    setCustomOrder([]);
    setPage(0);
    setItems([]);
    setSearch('');
    setFilterStates({}); // Очищаем кэш
    
    try {
      await saveUserState({ selectedIds: [], customOrder: [] });
    } catch (err: unknown) {
      setError('Не удалось сбросить настройки. Пожалуйста, попробуйте еще раз.');
      console.error('Ошибка при сбросе состояния:', err);
    }
  }, []);

  // Удаление элемента
  const handleDelete = useCallback(async (id: number) => {
    if (loading) return;
    setError(null);

    // Оптимистично удаляем элемент из локального состояния
    const prevItems = items;
    const prevCustomOrder = customOrder;
    const prevSelectedIds = new Set(selectedIds);
    const prevFilterStates = { ...filterStates }; // Сохраняем текущий кэш фильтров
    
    // Удаляем из локального состояния
    setItems(prevItems.filter(item => item.id !== id));
    setCustomOrder(prevCustomOrder.filter(itemId => itemId !== id));
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    
    // Обновляем кэш для всех фильтров (чтобы при смене фильтра не появлялся удаленный элемент)
    const newFilterStates = { ...prevFilterStates };
    Object.keys(newFilterStates).forEach(key => {
      if (newFilterStates[key]?.items) {
        newFilterStates[key].items = newFilterStates[key].items.filter(item => item.id !== id);
      }
    });
    setFilterStates(newFilterStates);

    try {
      await deleteItem(id);
      // Асинхронно обновляем состояние пользователя с учетом сортировки
      saveUserState({
        selectedIds: Array.from(selectedIds).filter(itemId => itemId !== id),
        customOrder: customOrder.filter(itemId => itemId !== id)
      });
    } catch {
      // Откатываем изменения, если ошибка
      setError('Не удалось удалить элемент. Пожалуйста, попробуйте еще раз.');
      setItems(prevItems);
      setCustomOrder(prevCustomOrder);
      setSelectedIds(prevSelectedIds);
      setFilterStates(prevFilterStates);
    }
  }, [loading, items, customOrder, selectedIds, filterStates]);

  // Мемоизация Row-компонента для улучшения производительности
  const Row = useMemo(() => {
    return ({ index, style }: { index: number, style: React.CSSProperties }) => {
      const item = items[index];
      if (!item) return null;
      
      const isSelected = selectedIds.has(item.id);
      const isDragging = draggingId === item.id;
      
      return (
        <Draggable draggableId={`item-${item.id}`} index={index} key={item.id}>
          {(provided, snapshot) => {
            if (snapshot.isDragging && draggingId !== item.id) setDraggingId(item.id);
            return (
              <div
                ref={provided.innerRef}
                {...provided.draggableProps}
                {...provided.dragHandleProps}
                className={`item-row${isSelected ? ' selected' : ''}${isDragging ? ' dragging' : ''}`}
                style={{ ...style, ...provided.draggableProps.style }}
              >
                <div className="item-cell checkbox">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelect(item.id)}
                    disabled={loading}
                  />
                </div>
                <div className="item-cell id">{item.id}</div>
                <div className="item-cell value">{item.value}</div>
                <div className="item-cell">
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(item.id)}
                    disabled={loading}
                    title="Удалить элемент"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          }}
        </Draggable>
      );
    };
  }, [items, selectedIds, draggingId, loading, handleSelect, handleDelete]);

  return (
    <div className="item-list-container">
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}
      
      <div className="item-list-header">
        <div className="search-bar">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="search-input"
            disabled={loading}
          />
        </div>
        <button 
          className="reset-btn" 
          onClick={handleReset} 
          disabled={loading}
        >
          Сбросить
        </button>
      </div>
      
      <div className="item-list-table">
        <div className="item-list-header-row">
          <div className="item-cell checkbox">
            <input
              type="checkbox"
              checked={selectedIds.size === items.length && items.length > 0}
              onChange={handleSelectAll}
              disabled={loading}
            />
          </div>
          <div className="item-cell id">ID</div>
          <div className="item-cell value">Значение</div>
        </div>
        
        {isInitialLoading ? (
          <div className="loading-indicator">Загрузка данных...</div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable 
              droppableId="items-list"
              mode="virtual"
              renderClone={(provided, _snapshot, rubric) => (
                <div
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                  ref={provided.innerRef}
                  className={`item-row dragging`}
                >
                  <div className="item-cell checkbox">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(items[rubric.source.index].id)}
                      readOnly
                    />
                  </div>
                  <div className="item-cell id">{items[rubric.source.index].id}</div>
                  <div className="item-cell value">{items[rubric.source.index].value}</div>
                </div>
              )}
            >
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {items.length === 0 && !loading && !isSearching ? (
                    <div className="empty-list">Нет данных</div>
                  ) : null}
                  
                  {isSearching ? (
                    <div className="loading-indicator search">Поиск...</div>
                  ) : (
                    <List
                      height={600}
                      itemCount={items.length}
                      itemSize={ROW_HEIGHT}
                      width="100%"
                      onScroll={handleScroll}
                    >
                      {Row}
                    </List>
                  )}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
        
        {isLoadingMore && !isInitialLoading && !isSearching && (
          <div className="loading-more">Загрузка дополнительных элементов...</div>
        )}
        
        {loading && !isInitialLoading && !isSearching && !isLoadingMore && (
          <div className="spinner"><div /></div>
        )}
        
        <div className="item-list-stats">
          Показано {items.length} из {total} элементов
          {selectedIds.size > 0 && `, выбрано: ${selectedIds.size}`}
        </div>
      </div>
    </div>
  );
}; 