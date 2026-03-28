const courses = [

/* CS COURSES */
"CS105",
"CS107",
"CS109",
"CS110",
"CS114L",
"CS119",
"CS187SL",
"CS188SL",
"CS210",
"CS220",
"CS240",
"CS271L",
"CS285L",
"CS310",
"CS341",
"CS410",
"CS413",
"CS415",
"CS420",
"CS430",
"CS435",
"CS436",
"CS437",
"CS438",
"CS442",
"CS443",
"CS444",
"CS446",
"CS449",
"CS450",
"CS451",
"CS460",
"CS461",
"CS470",
"CS478",
"CS480",
"CS495",
"CS498",

/* IT COURSES */
"IT110",
"IT111L",
"IT114L",
"IT116",
"IT117",
"IT187SL",
"IT188SL",
"IT220",
"IT221",
"IT230L",
"IT240",
"IT244",
"IT246",
"IT285L",
"IT341",
"IT360",
"IT370",
"IT420",
"IT421",
"IT425L",
"IT428L",
"IT442",
"IT443",
"IT444",
"IT456",
"IT460",
"IT461L",
"IT471",
"IT472",
"IT478",
"IT480",
"IT485",


];

const searchInput = document.getElementById("courseSearch");
const suggestionsBox = document.getElementById("suggestions");


/* Live suggestions */
searchInput.addEventListener("input", function(){

    const value = searchInput.value.toUpperCase();
    suggestionsBox.innerHTML = "";

    if(value.length === 0) return;

    const matches = courses.filter(course =>
        course.includes(value)
    );

    matches.forEach(course => {

        const item = document.createElement("div");
        item.classList.add("suggestion-item");
        item.textContent = course;

        item.onclick = function(){
            window.location.href = "browse.html?course=" + course;
        };

        suggestionsBox.appendChild(item);

    });

});


/* Search button */
function searchCourse(){

    const value = searchInput.value.toUpperCase();

    if(value){
        window.location.href = "browse.html?course=" + value;
    }

}