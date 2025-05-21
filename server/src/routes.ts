import express, { Request, Response } from 'express';
import { FetchItemsParams, UserState } from './types';
import { getFilteredItems, getUserState, updateUserState } from './data';

const router = express.Router();

// GET /api/items - получить элементы с пагинацией, фильтрацией и сортировкой
router.get('/items', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;
    
    const params: FetchItemsParams = { page, limit, search };
    const result = getFilteredItems(params);
    
    res.json(result);
  } catch (error) {
    console.error('Error getting items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/state - получить текущее состояние пользователя
router.get('/state', (_req: Request, res: Response) => {
  try {
    const state = getUserState();
    res.json(state);
  } catch (error) {
    console.error('Error getting state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/state - обновить состояние пользователя
router.post('/state', (req: Request, res: Response) => {
  try {
    const { selectedIds, customOrder } = req.body as UserState;
    
    // Валидация входных данных
    if (!Array.isArray(selectedIds) || !Array.isArray(customOrder)) {
      return res.status(400).json({ error: 'Invalid state format' });
    }
    
    const newState: UserState = { 
      selectedIds: selectedIds.filter(id => typeof id === 'number'),
      customOrder: customOrder.filter(id => typeof id === 'number')
    };
    
    const updatedState = updateUserState(newState);
    res.json(updatedState);
  } catch (error) {
    console.error('Error updating state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 