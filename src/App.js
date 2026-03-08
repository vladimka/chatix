import React from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import ChatRoom from './components/ChatRoom';
import './App.css';

function App() {
  return (
    <Provider store={store}>
      <div className="App">
        <ChatRoom />
      </div>
    </Provider>
  );
}

export default App;