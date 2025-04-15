import { supabase } from './supabaseClient.js';
  
window.handleSignUp = async function() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const msg = document.getElementById("message");
    const err = document.getElementById("error");
  
    msg.textContent = "Creating account, please wait ...";
    err.textContent = "";
  
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
  
    if (error) {
      err.textContent = error.message;
    } else {
      msg.textContent = "Successfully created account!";
      window.location.href = "index.html";
    }
}
