import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function Register() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const { register } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    register(nome, email, senha);
  };

  return (
    <div className="container">
      <form onSubmit={handleSubmit} className="form-container">
        <h2 className="form-title">Criar nova conta</h2>
        <input 
          placeholder="Nome" 
          value={nome} 
          onChange={(e) => setNome(e.target.value)} 
        />
        <input 
          placeholder="Email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
        />
        <input 
          type="password" 
          placeholder="Senha" 
          value={senha} 
          onChange={(e) => setSenha(e.target.value)} 
        />
        <button type="submit">Registrar</button>
        <p className="link-text">
          Já possui cadastro? <Link to="/login">Faça login</Link>
        </p>
      </form>
    </div>
  );
}