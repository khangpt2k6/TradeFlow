import { supabase } from "../lib/supabaseClient";

export const upsertUserProfile = async ({ userId, email, firstName, lastName, phone, address, dateOfBirth }) => {
  if (!userId || !supabase) return;

  const payload = {
    id: userId,
    email,
    first_name: firstName || null,
    last_name: lastName || null,
    phone: phone || null,
    address: address || null,
    date_of_birth: dateOfBirth || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) {
    throw new Error(error.message || "Failed to save profile");
  }
};

export const logTradeExecution = async ({ userId, symbol, side, quantity, price }) => {
  if (!userId || !supabase) return;

  const { error } = await supabase.from("trade_orders").insert({
    user_id: userId,
    symbol,
    side,
    quantity,
    execution_price: price,
  });

  if (error) {
    throw new Error(error.message || "Failed to persist trade");
  }
};
