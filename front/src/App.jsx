import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Messages from './components/Tasks';
import PrivateRoute from './components/PrivateRoute';
import Tasks from './components/Tasks';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><Tasks /></PrivateRoute>} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}