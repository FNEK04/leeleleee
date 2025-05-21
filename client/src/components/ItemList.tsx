import { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { FixedSizeList as List } from 'react-window';
import type { Item } from '../types';
import { fetchItems, fetchUserState, saveUserState } from '../api';
import './ItemList.css';

// Количество элементов для загрузки за один раз
const PAGE_SIZE = 20;

// Высота строки списка
const ROW_HEIGHT = 40;

// Компонент для списка/таблицы элементов
export const ItemList: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [customOrder, setCustomOrder] = useState<number[]>([]);
  const [search, setSearch] = useState<string>('');
  const [draggingId, setDraggingId] = useState<number | null>(null);

  // Загрузка состояния пользователя (выбранные элементы и сортировка)
  const loadUserState = useCallback(async () => {
    try {
      const state = await fetchUserState();
      setSelectedIds(new Set(state.selectedIds));
      setCustomOrder(state.customOrder);
    } catch {
      setSelectedIds(new Set());
      setCustomOrder([]);
    }
  }, []);

  // Загрузка элементов с пагинацией и поддержкой поиска
  const loadItems = useCallback(async (reset: boolean = false) => {
    try {
      setLoading(true);
      const currentPage = reset ? 0 : page;
      const result = await fetchItems(currentPage, PAGE_SIZE, search);
      setItems(prev => (reset ? result.items : [...prev, ...result.items]));
      setTotal(result.total);
      setHasMore(result.hasMore);
      if (!reset) {
        setPage(currentPage + 1);
      } else {
        setPage(1);
      }
    } catch (error) {
      console.error('Ошибка при загрузке элементов:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  // Инициализация: сначала userState, потом первая страница
  useEffect(() => {
    const init = async () => {
      await loadUserState();
      await loadItems(true);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Поиск
  useEffect(() => {
    const timer = setTimeout(() => {
      loadItems(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Обработка скролла для бесконечной загрузки
  const handleScroll = ({ scrollOffset, scrollDirection }: { scrollOffset: number, scrollDirection: string }) => {
    if (scrollDirection === 'forward' && !loading && hasMore) {
      const scrollThreshold = items.length * ROW_HEIGHT - 800;
      if (scrollOffset > scrollThreshold) {
        loadItems();
      }
    }
  };

  // Обработка выбора элемента (чекбокс)
  const handleSelect = async (itemId: number) => {
    if (loading) return;
    const newSet = new Set(selectedIds);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedIds(newSet);
    await saveUserState({ selectedIds: Array.from(newSet), customOrder });
  };

  // Множественный выбор (чекбоксы в шапке)
  const handleSelectAll = async () => {
    if (loading) return;
    let newSet: Set<number>;
    if (selectedIds.size === items.length) {
      newSet = new Set();
    } else {
      newSet = new Set<number>();
      items.forEach(item => newSet.add(item.id));
    }
    setSelectedIds(newSet);
    await saveUserState({ selectedIds: Array.from(newSet), customOrder });
  };

  // Обработка изменения сортировки (drag&drop)
  const handleDragEnd = async (result: DropResult) => {
    setDraggingId(null);
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    if (sourceIndex === destIndex) return;
    const newItems = [...items];
    const [moved] = newItems.splice(sourceIndex, 1);
    newItems.splice(destIndex, 0, moved);
    setItems(newItems);
    const newOrder = newItems.map(item => item.id);
    setCustomOrder(newOrder);
    await saveUserState({ selectedIds: Array.from(selectedIds), customOrder: newOrder });
  };

  // Сброс состояния
  const handleReset = async () => {
    setSelectedIds(new Set());
    setCustomOrder([]);
    setPage(0);
    setItems([]);
    setSearch('');
    await saveUserState({ selectedIds: [], customOrder: [] });
    await loadItems(true);
  };

  // Рендер строки в виртуализированном списке
  const Row = ({ index, style }: { index: number, style: React.CSSProperties }) => {
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
            </div>
          );
        }}
      </Draggable>
    );
  };

  return (
    <div className="item-list-container">
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
        <button className="reset-btn" onClick={handleReset} disabled={loading}>
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
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable 
            droppableId="items-list"
            mode="virtual"
            renderClone={(provided, snapshot, rubric) => (
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
                {items.length === 0 && !loading && (
                  <div className="empty-list">Нет данных</div>
                )}
                <List
                  height={600}
                  itemCount={items.length}
                  itemSize={ROW_HEIGHT}
                  width="100%"
                  onScroll={handleScroll}
                >
                  {Row}
                </List>
              </div>
            )}
          </Droppable>
        </DragDropContext>
        {loading && <div className="spinner"><div /></div>}
        <div className="item-list-stats">
          Показано {items.length} из {total} элементов
          {selectedIds.size > 0 && `, выбрано: ${selectedIds.size}`}
        </div>
      </div>
    </div>
  );
}; 