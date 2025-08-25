import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RootLayout from './components/RootLayout';
import SignIn from './components/SignIn';
import SignUp from './components/SignUp';
import Dashboard from './components/Dashboard';
import Events from './components/Events';
import CCTVLinks from './components/CCTVLinks';
import EventChat from './components/EventChat';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<RootLayout />}>
            <Route index element={<Navigate to="/signin" replace />} />
            <Route path="signin" element={<SignIn />} />
            <Route path="signup" element={<SignUp />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="events" element={<Events />} />
            <Route path="events/:eventId/chat" element={<EventChat />} />
            <Route path="cctvlinks" element={<CCTVLinks />} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;