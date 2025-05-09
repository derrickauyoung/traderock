// render.js
import { supabase } from './supabaseClient.js';
import {
    nextImage,
    prevImage,
    itemGalleryImages,
    itemGalleryIndex,
    setImageIfExists
} from './gallery.js';
import { renderBidHistory } from './bidHistory.js';
import { auction } from './constants.js';
import { requestCaptchaToken } from './captcha.js';

export function renderItem(container, item, currentUser, bids) {
    const card = document.createElement("div");
    card.id = `item-${item.id}`;
    card.className = "item-card";
    card.setAttribute("data-id", item.id);

    const imgGallery = document.createElement("div");
    imgGallery.className = "item-gallery"
    imgGallery.setAttribute("data-id", item.id);
    const firstImage = item.image_urls?.[0] || item.image_url;

    const prevButton = document.createElement("button");
    prevButton.className = "prev-btn";
    prevButton.textContent = "<";
    prevButton.onclick = () => prevImage(item.id);

    const img = document.createElement("img");
    if (bids.includes(item.id)) {
        const base = location.hostname === "localhost" ? "" : "/traderock";
        // no picture for sold items
        setImageIfExists(img, `${base}/images/sold.png`)
        img.alt = "SOLD";
        img.id = `img-${item.id}`;
        imgGallery.appendChild(img)
    }
    else {
        setImageIfExists(img, firstImage)
        img.alt = item.title;
        img.id = `img-${item.id}`;

        const nextButton = document.createElement("button");
        nextButton.className = "next-btn";
        nextButton.textContent = ">";
        nextButton.onclick = () => nextImage(item.id);

        imgGallery.appendChild(img)

        const imgGalleryBtns = document.createElement("div");
        imgGalleryBtns.appendChild(prevButton)
        imgGalleryBtns.appendChild(nextButton)

        if (item.image_urls) {
            if (item.image_urls.length > 1) {
               imgGallery.appendChild(imgGalleryBtns)
            }
        }
    }

    const title = document.createElement("h3");
    const link = document.createElement("a");
    link.href = `item.html?id=${item.id}`;
    link.textContent = item.title;
    title.appendChild(link);

    const seller = document.createElement("div");
    seller.id = `seller-${item.id}`;
    seller.className = "seller-name";
    seller.textContent = `Seller: ${item.seller_name}`;

    const desc = document.createElement("div");
    desc.className = "item-desc";
    desc.textContent = item.description;

    card.appendChild(imgGallery);

    // Store current index in memory
    itemGalleryIndex[item.id] = 0;
    itemGalleryImages[item.id] = item.image_urls || [];

    card.appendChild(title);
    card.appendChild(seller);
    card.appendChild(desc);

    const bidSection = document.createElement("div");
    bidSection.className = "bid-section";

    const priceDiv = document.createElement('div');
    priceDiv.className = 'price-section';

    const oldPrice = getOldPrice(item.id);

    if (oldPrice !== undefined && oldPrice !== item.buy_now) {
        const oldPriceSpan = document.createElement('span');
        oldPriceSpan.className = 'old-price';
        oldPriceSpan.textContent = `$${window.oldPrices[item.id]}`;

        const currentPriceSpan = document.createElement('span');
        currentPriceSpan.className = 'current-price';
        currentPriceSpan.textContent = `$${item.buy_now}`;

        priceDiv.appendChild(oldPriceSpan);
        priceDiv.appendChild(currentPriceSpan);
    } else {
        const currentPriceSpan = document.createElement('span');
        currentPriceSpan.className = 'current-price';
        currentPriceSpan.textContent = `$${item.buy_now}`;
        priceDiv.appendChild(currentPriceSpan);
    }
    bidSection.appendChild(priceDiv);

    const datenow = Date.now();
    const timestamptzMillis = new Date(item.end_date).getTime();
    if (timestamptzMillis > datenow) {
        const bnButton = document.createElement("button");
        bnButton.id = `bnbtn-${item.id}`;
        bnButton.className = "bn-btn";
        bnButton.textContent = "Request Now";
        bnButton.onclick = () => placeBuyNow(item.id, card, item.buy_now, item.seller_name);
        bidSection.appendChild(bnButton);
    }

    // Check if end date is past
    const end_date = document.createElement("div");
    end_date.className = "end-date";
    const endsAtDate = new Date(item.end_date);
    const formattedEndTime = endsAtDate.toLocaleString();
    const timeRemaining = timeUntil(item.end_date);
    end_date.textContent = `Offer ${timeRemaining} (${formattedEndTime})`;
    bidSection.appendChild(end_date);

    // Auction Bid Info
    if (auction()) {
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
        
        if (currentUser) {
            const input = document.createElement("input");
            input.type = "number";
            input.placeholder = "Enter your bid";
            input.id = `input-${item.id}`;
        
            const bidButton = document.createElement("button");
            bidButton.className = "bid-btn";
            bidButton.textContent = "Place Bid";
            bidButton.onclick = () => placeBid(item.id, card);

            if (timestamptzMillis > datenow) {
                bidSection.appendChild(priceInfo);
                bidSection.appendChild(input);
                bidSection.appendChild(bidButton);
            }
        }
    }
    card.appendChild(bidSection);
    container.appendChild(card);

    return card;
}

function getOldPrice(itemId) {
    const oldPrices = window.oldPrices || {};
    const oldprice = oldPrices[itemId?.toString()]
    return oldprice;
}

window.placeBuyNow = async function(id, card, price, seller_name) {
    const user = await authUser();

    if (!user) {
        console.error("User not logged in.");
        return;
    }

    // Close the auction and update bid history
    const success = await updateBidTable(user, price, id);
    if (!success) {
        console.warn("Bid update failed. Aborting buy now.");
        alert("❌ Something went wrong. Please contact site admin!")
        return;
    }

    // Update end time in Supabase
    const timestamptz = new Date().toISOString();
    const { error } = await supabase
        .from("items")
        .update({ end_date: timestamptz })
        .eq("id", id);
    
    if (error) {
        console.error("Error updating end date:", error);
        alert("❌ Something went wrong. Try again.");
        return;
    }

    // Update UI
    renderBidHistory(id, card, user);
    const buynowbtn = document.getElementById(`bnbtn-${id}`);
    buynowbtn.remove();
    alert("✅ Congrats on your purchase! Please contact seller: " + seller_name);
};

// Expose this function globally
window.placeBid = async function(id, card) {
    const user = await authUser();

    if (!user) {
        console.error("User not logged in.");
        return;
    }

    const inputEl = document.getElementById(`input-${id}`);
    const bidValue = parseFloat(inputEl.value);
    
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

    // Update bid table
    const success = await updateBidTable(user, bidValue, id);
    if (!success) {
        console.warn("Bid update failed. Aborting buy now.");
        alert("❌ Something went wrong. Please contact site admin!")
        return;
    }
    
    // Update UI
    renderBidHistory(id, card, user);
    inputEl.value = "";
    alert("✅ Bid placed successfully!");
};

export async function authUser() {
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

    return user;
}

export async function updateBidTable(user, bidValue, id) {
    // Get hCaptcha token from the widget
    const token = await requestCaptchaToken();

    if (!token) {
        return false;
    }
    
    const bidder = user?.email
    if (bidder) {
        console.log("User email:", bidder);
    }
    else {
        console.error("Problem retrieving user email.");
        alert("❌ Please sign up or log in.");
        return false;
    }
    
    // Check if there is already a bid at this price
    const { data: bids, error: bidsError } = await supabase
        .from("bids")
        .select("amount")
        .eq("item_id", id)
        .eq("amount", bidValue);
    if (bidsError) {
        console.error("Error retrieving current bids:", bidsError);
        alert("❌ Something went wrong. Try again.");
        return false;
    }

    if (bids.length > 0) {
        console.warn("There is already a bid at this amount.");
        alert("🚫 Someone already placed this exact bid. Try a different amount.");
        return false;
    }

    // Update bid in Supabase
    const { error: updateError } = await supabase
        .from("items")
        .update({ current_bid: bidValue })
        .eq("id", id);
    
    if (updateError) {
        console.error("Error updating bid:", updateError);
        alert("❌ Failed to update item.");
        return false;
    }
    
    const { error: insertError } = await supabase.from("bids").insert([{
        item_id: id,
        amount: bidValue,
        bidder_name: bidder,
        user_id: user?.id
    }]);

    if (insertError) {
        console.error("Error inserting bid:", insertError);
        alert("❌ Failed to save bid. Try again.");
        return false;
    }

    return true;
}

// 🎨 Render auction items to the page
export function renderItems(items, currentUser, bids) {
    const container = document.getElementById("items-container");
    container.innerHTML = ""; // Clear old items
  
    items.forEach(item => {
        renderItem(container, item, currentUser, bids)
    });
}

export function timeUntil(date) {
    const now = new Date();
    const future = new Date(date);
    const seconds = Math.floor((future - now) / 1000);
  
    if (seconds <= 0) return "Ended";
  
    const intervals = {
      year: 31536000,
      month: 2592000,
      day: 86400,
      hour: 3600,
      minute: 60,
    };
  
    for (const [unit, secondsPer] of Object.entries(intervals)) {
      const rawAmount = seconds / secondsPer;
      if (rawAmount >= 1) {
        const rounded = Math.round(rawAmount * 10) / 10; // 1 decimal
        return `ends in ${rounded} ${unit}${rounded !== 1 ? 's' : ''}`;
      }
    }
  
    return "ends in a few seconds";
  }
