import { useEffect, useRef, useState } from "react";
import { AuthContext } from "./AuthContext";

let supabaseClientPromise;
function getSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import("./supabase").then(
      (supabaseModule) => supabaseModule.supabase
    );
  }
  return supabaseClientPromise;
}

async function checkEmailExists(supabaseClient, email) {
  const { data, error } = await supabaseClient.rpc("check_email_exists", {
    p_email: email,
  });

  if (error) {
    console.error("[Auth] Gagal memeriksa keberadaan email:", error.message);
    return null;
  }

  return Boolean(data);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    getSupabaseClient().then((supabaseClient) => {
      if (!isMounted) return;

      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
        setLoading(false);
      });

      const { data: authListener } = supabaseClient.auth.onAuthStateChange(
        (_authEvent, session) => {
          setUser(session?.user ?? null);
        }
      );
      unsubscribeRef.current = () => authListener.subscription.unsubscribe();
    });

    return () => {
      isMounted = false;
      unsubscribeRef.current?.();
    };
  }, []);

  const signIn = async (email, password) => {
    const supabaseClient = await getSupabaseClient();
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    const signedUser = data?.user ?? data?.session?.user;
    if (!error && signedUser) {
      setUser(signedUser);
      return { success: true, errorCode: null };
    }

    if (!error) {
      console.error("[Auth] signIn succeeded but no user was returned", data);
      return {
        success: false,
        errorCode: "unknown",
        error: "Login gagal: respons Supabase tidak berisi data pengguna.",
      };
    }

    const errorMessage = (error.message || "").toLowerCase();

    if (errorMessage.includes("invalid login credentials")) {
      const emailExists = await checkEmailExists(supabaseClient, email);

      if (emailExists === null) {
        return { success: false, errorCode: "invalid_credentials", error: error.message };
      }

      return {
        success: false,
        errorCode: emailExists ? "wrong_password" : "email_not_found",
        error: error.message,
      };
    }

    if (errorMessage.includes("email not confirmed")) {
      return { success: false, errorCode: "email_not_confirmed", error: error.message };
    }

    if (errorMessage.includes("rate limit") || errorMessage.includes("too many")) {
      return { success: false, errorCode: "too_many_requests", error: error.message };
    }

    if (errorMessage.includes("fetch") || errorMessage.includes("network")) {
      return { success: false, errorCode: "network_error", error: error.message };
    }

    return { success: false, errorCode: "unknown", error: error.message };
  };

  const signOut = async () => {
    const supabaseClient = await getSupabaseClient();
    await supabaseClient.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
