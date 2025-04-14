document.addEventListener("DOMContentLoaded", () => {

    const SUPABASE_URL = 'https://napmuiqctvbegldujfbb.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hcG11aXFjdHZiZWdsZHVqZmJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1MzQ1NzYsImV4cCI6MjA2MDExMDU3Nn0.U4SPKOZNpnhhTUzYdiRP_t8O0cAWKrefFrN_ic7jQ6g';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Expose supabase + placeBid globally if needed
    window.supabase = supabase;

    window.signUp = async function() {
        const email = document.getElementById("auth-email").value;
        const password = document.getElementById("auth-password").value;
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          alert("Sign Up Error: " + error.message);
        } else {
          alert("Check your email to confirm your account!");
        }
    }
      
    window.signIn = async function() {
        const email = document.getElementById("auth-email").value;
        const password = document.getElementById("auth-password").value;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            alert("Login Error: " + error.message);
        } else {
            updateAuthStatus();
        }
    }
    
    window.signOut = async function() {
        await supabase.auth.signOut();
            updateAuthStatus();
    }
    
    window.updateAuthStatus = async function() {
        const { data: { user } } = await supabase.auth.getUser();
        const statusEl = document.getElementById("auth-status");
        
        if (user) {
            statusEl.textContent = `Logged in as ${user.email}`;
        } else {
            statusEl.textContent = "Not logged in";
        }
    }
    
    // ⚙️ Run after the page loads
    loadItems();
  
    // 📦 Load items from Supabase and render them
    async function loadItems() {
        const { data, error } = await supabase
            .from("items")
            .select("*")
            .order("id", { ascending: true });

        if (error) {
            console.error("Error loading items:", error);
            alert("❌ Failed to load auction items.");
            return;
        }

        renderItems(data);
    }
    
    // 🎨 Render auction items to the page
    function renderItems(items) {
        const container = document.getElementById("items-container");
        container.innerHTML = ""; // Clear old items
      
        items.forEach(item => {
            const card = document.createElement("div");
            card.className = "item-card";
            card.setAttribute("data-id", item.id);
        
            const img = document.createElement("img");
            img.src = item.image_url;
            img.alt = item.title;
        
            const title = document.createElement("h3");
            title.textContent = item.title;

            const desc = document.createElement("div");
            desc.className = "item-desc";
            desc.textContent = item.description;
        
            const priceInfo = document.createElement("div");

            const startingBidText = `<p><strong>Starting Bid:</strong> $${item.starting_bid}</p>`;

            const currentBid = item.current_bid ?? item.starting_bid;

            let currentBidText = "";
            if (item.current_bid !== null && currentBid !== item.starting_bid) {
                currentBidText = `<p id="bid-${item.id}"><strong>Current Bid:</strong> $${currentBid}</p>`;
            } else {
                currentBidText = `<p id="bid-${item.id}"></p>`; // empty element for consistent updating later
            }

            priceInfo.innerHTML = startingBidText + currentBidText;
        
            const input = document.createElement("input");
            input.type = "number";
            input.placeholder = "Enter your bid";
            input.id = `input-${item.id}`;
        
            const button = document.createElement("button");
            button.className = "bid-btn";
            button.textContent = "Place Bid";
            button.onclick = () => placeBid(item.id);
        
            card.appendChild(img);
            card.appendChild(title);
            if (item.description !== null) {
                card.appendChild(desc);
            }
            card.appendChild(priceInfo);
            card.appendChild(input);

            // Check if end date is past
            const end_date = document.createElement("div");
            end_date.className = "end-date";
            end_date_text = `<p><strong>Auction ended:</strong> ${item.end_date}</p>`;
            end_date.innerHTML = end_date_text;

            console.info("End date: ", item.end_date.timestamp);
            console.info("Now: ", Date.now());
            if (item.end_date.timestamp > Date.now()) {
                card.appendChild(button);
            }
            else {
                card.append(end_date);
            }

            container.appendChild(card);
        
            // Render bid history under each card
            renderBidHistory(item.id, card);
        });
    }

    async function renderBidHistory(itemId, container) {
        const { data: bids, error } = await supabase
          .from("bids")
          .select("*")
          .eq("item_id", itemId)
          .order("created_at", { ascending: false });
      
        if (error) {
          console.error("Failed to load bid history:", error);
          return;
        }
      
        const list = document.createElement("ul");
        list.className = "bid-history";
      
        bids.forEach(bid => {
          const li = document.createElement("li");
          li.textContent = `$${bid.amount} by ${bid.bidder_name || "Anonymous"} on ${new Date(bid.created_at).toLocaleString()}`;
          list.appendChild(li);
        });
      
        container.appendChild(list);
    }

    // Expose this function globally
    window.placeBid = async function(id) {
        const inputEl = document.getElementById(`input-${id}`);
        const bidValue = parseFloat(inputEl.value);

        const {
            data: { user }
        } = await supabase.auth.getUser();

        if (user) {
            console.log("Signed in.")
        }
        else {
            alert("❌ Please sign up or log in.");
            return;
        }
        
        if (isNaN(bidValue)) {
            alert("❌ Please enter a valid number.");
            return;
        }
        
        // Get current item info from the DOM
        const currentBidEl = document.getElementById(`bid-${id}`);
        const currentBidText = currentBidEl.innerText;
        const currentBid = parseFloat(currentBidText.replace("Current Bid: $", ""));
        
        if (bidValue <= currentBid) {
            alert("🚫 Your bid must be higher than the current bid.");
            return;
        }
        
        // Update bid in Supabase
        const { error } = await supabase
            .from("items")
            .update({ current_bid: bidValue })
            .eq("id", id);
        
        if (error) {
            console.error("Error updating bid:", error);
            alert("❌ Something went wrong. Try again.");
            return;
        }
        
        // Update UI
        await loadItems(); // Reload all items from Supabase
        inputEl.value = "";
        alert("✅ Bid placed successfully!");

        await supabase.from("bids").insert([{
            item_id: id,
            amount: bidValue,
            bidder_name: user?.email || "Anonymous", // or store user.id instead
            user_id: user?.id // if you want to add that to your bids table
        }]);

        const itemCard = document.querySelector(`.item-card[data-id="${id}"]`);
        const oldHistory = itemCard.querySelector(".bid-history");
        if (oldHistory) oldHistory.remove(); // remove old list
        await renderBidHistory(id, itemCard); // re-render new list
    };
});
