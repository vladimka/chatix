import React from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import ChatRoom from './components/ChatRoom';

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