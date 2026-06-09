const AuthService = require('../services/authService');
const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');

jest.mock('../lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn()
  }
}));

jest.mock('../services/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true })
}));

describe('AuthService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    test('debe registrar un usuario correctamente si el email no está duplicado', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-id-123',
        name: 'Mariano Martinez',
        email: 'mariano@example.com',
        role: 'BUYER',
        isVerified: false
      });

      const result = await AuthService.register({
        name: 'Mariano Martinez',
        email: 'mariano@example.com',
        password: 'securePassword123'
      });

      expect(result.user.email).toBe('mariano@example.com');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    test('debe arrojar error si el usuario ya existe', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        AuthService.register({
          name: 'Mariano Martinez',
          email: 'mariano@example.com',
          password: 'securePassword123'
        })
      ).rejects.toThrow('El usuario ya existe');
    });
  });

  describe('login', () => {
    test('debe loguearse con credenciales válidas', async () => {
      const hashedPassword = await bcrypt.hash('my-password', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id-123',
        email: 'mariano@example.com',
        password: hashedPassword,
        loginAttempts: 0,
        lockUntil: null
      });

      const user = await AuthService.login('mariano@example.com', 'my-password');
      expect(user.id).toBe('user-id-123');
    });

    test('debe fallar si las credenciales son incorrectas e incrementar intentos', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id-123',
        email: 'mariano@example.com',
        password: 'wrong-hash',
        loginAttempts: 0,
        lockUntil: null
      });

      prisma.user.update.mockResolvedValue({});

      await expect(
        AuthService.login('mariano@example.com', 'wrong-password')
      ).rejects.toThrow('Credenciales inválidas');
      expect(prisma.user.update).toHaveBeenCalled();
    });

    test('debe bloquear la cuenta si supera el limite de 5 intentos fallidos', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id-123',
        email: 'mariano@example.com',
        password: 'wrong-hash',
        loginAttempts: 4,
        lockUntil: null
      });

      prisma.user.update.mockResolvedValue({});

      await expect(
        AuthService.login('mariano@example.com', 'wrong-password')
      ).rejects.toThrow('Credenciales inválidas');

      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          lockUntil: expect.any(Date),
          loginAttempts: 0
        })
      }));
    });
  });
});
