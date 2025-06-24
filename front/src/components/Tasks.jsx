import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const url = "http://localhost:8000";
  const { logout } = useAuth();

  useEffect(() => {
    if (!token) {
      navigate('/login');
    } else {
      fetchTasks();
      fetchOverview();
    }
  }, [token, navigate, filterStatus, filterPriority]);

  const fetchTasks = async () => {
    try {
      let query = `${url}/tasks`;
      const params = new URLSearchParams();
      
      if (filterStatus) params.append('status', filterStatus);
      if (filterPriority) params.append('priority', filterPriority);
      
      if (params.toString()) query += `?${params.toString()}`;
      
      const response = await axios.get(query, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setTasks(response.data);
    } catch (error) {
      console.error('Erro ao carregar tarefas:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    }
  };

  const fetchOverview = async () => {
    try {
      const response = await axios.get(`${url}/tasks/overview`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setOverview(response.data);
    } catch (error) {
      console.error('Erro ao carregar overview:', error);
    }
  };

  const createTask = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('A descrição da tarefa é obrigatória');
      return;
    }

    try {
      setLoading(true);
      const taskData = {
        description,
        priority,
        due_date: dueDate || null
      };

      const response = await axios.post(
        `${url}/tasks`,
        taskData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setTasks(prev => [response.data, ...prev]);
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setError('');
      await fetchOverview();
    } catch (error) {
      console.error('Erro ao criar tarefa:', error);
      setError(error.response?.data?.detail || 'Erro ao criar tarefa');
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      await axios.put(
        `${url}/tasks/${taskId}`,
        { status: newStatus },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      fetchTasks();
      fetchOverview();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await axios.delete(`${url}/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setTasks(prev => prev.filter(task => task.id !== taskId));
      await fetchOverview();
    } catch (error) {
      console.error('Erro ao deletar tarefa:', error);
    }
  };

  const startEditing = (task) => {
    setEditingTask(task);
    setDescription(task.description);
    setPriority(task.priority);
    setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
  };

  const cancelEditing = () => {
    setEditingTask(null);
    setDescription('');
    setPriority('medium');
    setDueDate('');
  };

  const updateTask = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('A descrição da tarefa é obrigatória');
      return;
    }

    try {
      setLoading(true);
      const taskData = {
        description,
        priority,
        due_date: dueDate || null
      };

      await axios.put(
        `${url}/tasks/${editingTask.id}`,
        taskData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      fetchTasks();
      cancelEditing();
      setError('');
      await fetchOverview();
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
      setError(error.response?.data?.detail || 'Erro ao atualizar tarefa');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Minhas Tarefas</h1>
        <button 
          onClick={logout}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
        >
          Sair
        </button>
      </div>

      {/* Overview */}
      {overview && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="text-xl font-semibold mb-3">Visão Geral</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <h3 className="font-medium mb-2">Por Status</h3>
              <ul>
                {Object.entries(overview.status_counts).map(([status, count]) => (
                  <li key={status} className="flex justify-between">
                    <span className="capitalize">{status.replace('_', ' ')}</span>
                    <span>{count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <h3 className="font-medium mb-2">Por Prioridade</h3>
              <ul>
                {Object.entries(overview.priority_counts).map(([priority, count]) => (
                  <li key={priority} className="flex justify-between">
                    <span className="capitalize">{priority}</span>
                    <span>{count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <h3 className="font-medium mb-2">Próximas Tarefas</h3>
              {overview.upcoming_tasks.length > 0 ? (
                <ul>
                  {overview.upcoming_tasks.slice(0, 3).map(task => (
                    <li key={task.id} className="mb-1 truncate">
                      {task.description} - {new Date(task.due_date).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Nenhuma tarefa próxima</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-xl font-semibold mb-3">Filtrar Tarefas</h2>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border rounded p-2"
            >
              <option value="">Todos</option>
              <option value="pending">Pendente</option>
              <option value="in_progress">Em Progresso</option>
              <option value="completed">Concluído</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prioridade</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="border rounded p-2"
            >
              <option value="">Todas</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
          <button
            onClick={() => {
              setFilterStatus('');
              setFilterPriority('');
            }}
            className="self-end px-3 py-2 bg-gray-200 rounded hover:bg-gray-200"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Formulário */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-xl font-semibold mb-3">
          {editingTask ? 'Editar Tarefa' : 'Adicionar Nova Tarefa'}
        </h2>
        {error && <p className="text-red-500 mb-3">{error}</p>}
        <form onSubmit={editingTask ? updateTask : createTask}>
          <div className="grid grid-cols-1 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Descrição*</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border rounded p-2 min-h-[100px]"
                required
                placeholder="Descreva sua tarefa..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Prioridade</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full border rounded p-2"
                >
                  <option value="high">Alta</option>
                  <option value="medium">Média</option>
                  <option value="low">Baixa</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data de Vencimento</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border rounded p-2"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editingTask && (
              <button
                type="button"
                onClick={cancelEditing}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
            >
              {loading ? 'Salvando...' : editingTask ? 'Atualizar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Tarefas */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-semibold mb-3">Lista de Tarefas</h2>
        {tasks.length === 0 ? (
          <p className="text-gray-500">Nenhuma tarefa encontrada</p>
        ) : (
          <ul className="space-y-3">
            {tasks.map(task => (
              <li key={task.id} className="border rounded-lg p-4 hover:shadow-md transition">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-gray-800">{task.description}</p>
                    <div className="flex gap-2 mt-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                        {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
                        {task.status === 'completed' ? 'Concluído' : task.status === 'in_progress' ? 'Em Progresso' : 'Pendente'}
                      </span>
                      {task.due_date && (
                        <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditing(task)}
                      className="p-1 text-blue-500 hover:text-blue-700"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-1 text-red-500 hover:text-red-700"
                      title="Excluir"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-2 border-t">
                  {task.status !== 'pending' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'pending')}
                      className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      Marcar como Pendente
                    </button>
                  )}
                  {task.status !== 'in_progress' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'in_progress')}
                      className="text-xs px-2 py-1 bg-blue-100 rounded hover:bg-blue-200"
                    >
                      Marcar como Em Progresso
                    </button>
                  )}
                  {task.status !== 'completed' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'completed')}
                      className="text-xs px-2 py-1 bg-green-100 rounded hover:bg-green-200"
                    >
                      Marcar como Concluído
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}