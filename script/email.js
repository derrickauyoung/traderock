// email.js

export async function sendMail(buyerEmail, sellerName, itemTitle, price, ccEmails=[]) {
    const user = supabase.auth.getUser();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const baseUrl =
    window.location.hostname === "localhost"
      ? "http://localhost:54321/functions/v1"
      : "https://napmuiqctvbegldujfbb.supabase.co/functions/v1";

    const response = await fetch(`${baseUrl}/send-confirmation-email`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
        buyerEmail,
        sellerName,
        itemTitle,
        price,
        ccEmails
        }),
    });

    if (!response.ok) {
        throw new Error(`Email failed with status ${response.status}`);
    }
    
    return response.json();
}