export const getUserId = (): number | null => {
  const id = localStorage.getItem('facepay_user_id');
  return id ? parseInt(id, 10) : null;
};

export const setUserId = (id: number) => {
  localStorage.setItem('facepay_user_id', id.toString());
};

export const clearUserId = () => {
  localStorage.removeItem('facepay_user_id');
};
