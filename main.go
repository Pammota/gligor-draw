package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Message struct {
	Type    string      `json:"type"`
	Content interface{} `json:"content"`
	Color   string      `json:"color"`
}

type Point struct {
	X int `json:"x"`
	Y int `json:"y"`
}

var connections = make(map[*websocket.Conn]bool)
var broadcast = make(chan Message)
var mutex = sync.Mutex{}

func main() {
	port := flag.Int("port", 8080, "Port to listen on")
	flag.Parse()

	go handleMessages()

	http.HandleFunc("/", serveHome)
	http.HandleFunc("/ws", handleConnections)

	log.Printf("Starting server on port %d...\n", *port)
	err := http.ListenAndServe(fmt.Sprintf(":%d", *port), nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}

func serveHome(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "home.html")
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Fatal(err)
	}
	defer ws.Close()

	mutex.Lock()
	connections[ws] = true
	mutex.Unlock()

	for {
		var msg Message
		err := ws.ReadJSON(&msg)
		if err != nil {
			log.Printf("error: %v", err)
			mutex.Lock()
			delete(connections, ws)
			mutex.Unlock()
			break
		}
		switch msg.Type {
		case "draw":
			broadcast <- msg
		case "clear":
			mutex.Lock()
			for conn := range connections {
				err := conn.WriteJSON(msg)
				if err != nil {
					log.Printf("error: %v", err)
					delete(connections, conn)
					conn.Close()
				}
			}
			mutex.Unlock()
		}
	}
}

func handleMessages() {
	for {
		msg := <-broadcast
		mutex.Lock()
		for conn := range connections {
			if msg.Type == "ping" { // Reset the read deadline
				conn.SetReadDeadline(time.Now().Add(5 * time.Minute))
			} else {
				err := conn.WriteJSON(msg)
				if err != nil {
					log.Printf("error: %v", err)
					delete(connections, conn)
					conn.Close()
				}
			}
		}
		mutex.Unlock()
	}
}
