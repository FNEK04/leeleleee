const express = require('express');
const cors = require('cors');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(compression());
app.use(express.json());

// Тестовый маршрут
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// Массив элементов (генерируем все 1 000 000)
const items = Array.from({ length: 1000000 }, (_, i) => ({ id: i + 1, value: i + 1 }));

// Состояние пользователя
let userState = {
  selectedIds: [],
  customOrder: []
};

// Получить элементы с фильтрацией и пагинацией
app.get('/api/items', (req, res) => {
  const page = parseInt(req.query.page) || 0;
  const limit = parseInt(req.query.limit) || 20;
  const search = req.query.search;

  let filtered = items;
  if (search && search.length > 0) {
    // Быстрая фильтрация по строке
    filtered = items.filter(item => String(item.value).includes(search));
  }

  if (userState.customOrder.length > 0) {
    const orderMap = new Map(userState.customOrder.map((id, idx) => [id, idx]));
    filtered = filtered.length > 1 ? filtered.slice() : filtered;
    filtered.sort((a, b) => {
      const aIdx = orderMap.has(a.id) ? orderMap.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bIdx = orderMap.has(b.id) ? orderMap.get(b.id) : Number.MAX_SAFE_INTEGER;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return a.id - b.id;
    });
  }

  const start = page * limit;
  const end = start + limit;
  const paginated = filtered.length > end ? filtered.slice(start, end) : filtered.slice(start);

  res.json({
    items: paginated,
    total: filtered.length,
    hasMore: end < filtered.length
  });
});

// Получить состояние пользователя
app.get('/api/state', (req, res) => {
  res.json(userState);
});

// Обновить состояние пользователя
app.post('/api/state', (req, res) => {
  const { selectedIds, customOrder } = req.body;
  userState.selectedIds = Array.isArray(selectedIds) ? selectedIds : [];
  userState.customOrder = Array.isArray(customOrder) ? customOrder : [];
  res.json(userState);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 