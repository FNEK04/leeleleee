import { ItemList } from './components/ItemList';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Список элементов (1-1 000 000)</h1>
      </header>
      <main className="app-content">
        <ItemList />
      </main>
      </div>
  );
}

export default App;
