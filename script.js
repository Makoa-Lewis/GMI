(function(){
  var header=document.querySelector(".site-header");
  function onScroll(){header.classList.toggle("scrolled",window.scrollY>8)}
  window.addEventListener("scroll",onScroll,{passive:true});onScroll();

  var btn=document.getElementById("menu-btn"),links=document.getElementById("nav-links");
  function setMenu(open){links.classList.toggle("open",open);btn.setAttribute("aria-expanded",open);btn.setAttribute("aria-label",open?"Close menu":"Open menu")}
  btn.addEventListener("click",function(){setMenu(!links.classList.contains("open"))});
  links.addEventListener("click",function(e){if(e.target.closest("a"))setMenu(false)});

  if(document.getElementById("contact-form")){
  document.querySelectorAll("[data-topic]").forEach(function(a){
    a.addEventListener("click",function(){var s=document.getElementById("f-topic");for(var i=0;i<s.options.length;i++){if(s.options[i].text===a.dataset.topic){s.selectedIndex=i}}});
  });

  var copyBtn=document.getElementById("copy-email"),email=document.getElementById("email");
  copyBtn.addEventListener("click",function(){
    var done=function(t){copyBtn.textContent=t;setTimeout(function(){copyBtn.textContent="Copy"},1600)};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(email.textContent).then(function(){done("Copied")},sel)}else{sel()}
    function sel(){var r=document.createRange();r.selectNodeContents(email);var s=getSelection();s.removeAllRanges();s.addRange(r);done("Selected")}
  });

  var form=document.getElementById("contact-form"),status=document.getElementById("form-status"),send=document.getElementById("f-send");
  form.addEventListener("input",function(){status.textContent="";status.className="form-status"});
  form.addEventListener("submit",function(e){
    e.preventDefault();
    var name=form.elements["name"].value.trim(),mail=form.elements["email"].value.trim(),msg=form.elements["message"].value.trim();
    status.className="form-status err";
    if(!name){status.textContent="Add your name.";form.elements["name"].focus();return}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)){status.textContent="Enter a valid email address.";form.elements["email"].focus();return}
    if(!msg){status.textContent="Write a message.";form.elements["message"].focus();return}
    send.disabled=true;status.className="form-status";status.textContent="Sending…";
    fetch("/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(new FormData(form)).toString()})
      .then(function(r){if(!r.ok)throw new Error(r.status);status.className="form-status ok";status.textContent="Thanks, "+name.split(" ")[0]+". Your message was sent.";form.reset()})
      .catch(function(){status.className="form-status err";status.textContent="The message couldn't be sent from here. Email us at info@globalmusicinitiative.org instead."})
      .then(function(){send.disabled=false});
  });
  }

  var af=document.getElementById("apply-form");
  if(af){
    var ast=document.getElementById("apply-status"),asend=document.getElementById("a-send");
    af.addEventListener("input",function(e){var f=e.target.closest(".field");if(f)f.classList.remove("invalid");ast.textContent="";ast.className="form-status"});
    af.addEventListener("submit",function(e){
      e.preventDefault();
      var bad=null;
      af.querySelectorAll("[required]").forEach(function(el){
        var ok=el.type==="checkbox"?el.checked:el.value.trim()!=="";
        if(ok&&el.type==="email")ok=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim());
        var f=el.closest(".field");if(f)f.classList.toggle("invalid",!ok);
        if(!ok&&!bad)bad=el;
      });
      if(bad){ast.className="form-status err";ast.textContent=bad.id==="a-consent"?"Please check the box at the end to confirm.":"Please fill in the highlighted fields.";bad.focus();return}
      asend.disabled=true;ast.className="form-status";ast.textContent="Submitting…";
      var fd=new FormData(af),roles=fd.getAll("roles");fd.delete("roles");fd.append("roles",roles.join(", "));
      fetch("/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(fd).toString()})
        .then(function(r){if(!r.ok)throw new Error(r.status);var n=af.elements["name"].value.trim().split(" ")[0];af.reset();ast.className="form-status ok";ast.textContent="Thank you, "+n+". Your application was received. We'll be in touch before February 28, 2027."})
        .catch(function(){ast.className="form-status err";ast.textContent="Your application couldn't be sent. Please try again, or email info@globalmusicinitiative.org."})
        .then(function(){asend.disabled=false});
    });
  }
})();
