import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const url = "http://localhost:8000";
  const { logout } = useAuth();

  useEffect(() => {
    if (!token) {
      navigate('/login');
    } else {
      fetchMessages();
    }
  }, [token, navigate]);

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${url}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!title.trim() || !newMessage.trim()) {
      setError('Preencha todos os campos');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(
        `${url}/messages`,
        { title, text: newMessage },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setMessages(prev => [response.data, ...prev]);
      setNewMessage('');
      setTitle('');
      setError('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        setError(error.response?.data?.detail || 'Erro ao enviar mensagem');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Enviar Mensagem</h2>
        <button 
          onClick={logout}
          style={{
            padding: '8px 16px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Sair
        </button>
      </div>
      
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      <form onSubmit={sendMessage} style={{ marginBottom: '30px' }}>
        <div style={{ marginBottom: '15px' }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Mensagem"
            required
            style={{ width: '100%', padding: '8px', minHeight: '100px' }}
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            padding: '10px 15px', 
            background: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>

      <h3>Mensagens</h3>
      {messages.length === 0 ? (
        <p>Nenhuma mensagem encontrada</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {messages.map(msg => (
            <li key={msg.id} style={{ 
              marginBottom: '20px', 
              padding: '15px', 
              border: '1px solid #ddd', 
              borderRadius: '4px'
            }}>
              <h4 style={{ marginTop: 0 }}>{msg.title}</h4>
              <p>{msg.text}</p>
              <small style={{ color: '#666' }}>
                {new Date(msg.created_at).toLocaleString('pt-BR')}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}