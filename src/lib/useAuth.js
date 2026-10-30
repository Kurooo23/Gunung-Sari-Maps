import { useContext } from "react";
import { AuthContext } from "./AuthContext";

export function useAuth() {
  const authContext = useContext(AuthContext);
  if (authContext === undefined) {
    throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  }
  return authContext;
}
