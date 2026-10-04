export const user = { id: '00000000-0000-0000-0000-000000000001' };
export const useAuth = () => ({ user, loading: false });
export const useAuthUser = useAuth;
export const useCliente = () => ({ data: { id: '00000000-0000-0000-0000-000000000101' } });
export const getClienteId = async () => '00000000-0000-0000-0000-000000000101';
