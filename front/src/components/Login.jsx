import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const { login } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    login(email, senha);
  };

  return (
    <div className="container">
    <form onSubmit={handleSubmit}>
              <h2 className="form-title">Login</h2>
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
      <button type="submit">Login</button>
      <p>Não tem conta? <Link to="/register">Cadastre-se</Link></p>
    </form>
    </div>
  );
}