let emailGlobal = "";

document.getElementById("loginForm").addEventListener("submit", function(e){
    e.preventDefault();

    const email = document.getElementById("email").value;
    emailGlobal = email;

    if(!email.endsWith("@umb.edu")){
        document.getElementById("message").innerText = "Only UMB students can login.";
        return;
    }

    fetch("/login", {
        method: "POST",
        headers: {
            "Content-Type":"application/json"
        },
        body: JSON.stringify({ email })
    })
    .then(res => res.json())
    .then(data => {

        document.getElementById("message").innerText = data.message;

        if(data.success){
            showCodeInput();
        }
    });
});

// =======================
// SHOW CODE INPUT
// =======================
function showCodeInput() {

    const container = document.querySelector(".login-container");

    container.innerHTML += `
        <div id="codeSection">
            <input type="text" id="code" placeholder="Enter verification code">
            <button onclick="verifyCode()">Verify</button>
        </div>
    `;
}

// =======================
// VERIFY CODE
// =======================
function verifyCode() {

    const code = document.getElementById("code").value;

    fetch("/verify-code", {
        method: "POST",
        headers: {
            "Content-Type":"application/json"
        },
        body: JSON.stringify({
            email: emailGlobal,
            code: code
        })
    })
    .then(res => res.json())
    .then(data => {

        document.getElementById("message").innerText = data.message;

        if(data.success){
            // ✅ STORE BOTH
            localStorage.setItem("user_id", data.user_id);
            localStorage.setItem("userEmail", data.email); 

            window.location.href = "index.html";
        }
    });
}