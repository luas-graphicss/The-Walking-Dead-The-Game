# The Walking Dead The Game

[Read in English](README.md)

Um jogo em terceira pessoa no universo de The Walking Dead que roda no navegador, feito com Next.js, React Three Fiber, three.js e o motor de física Rapier. O mapa é gerado proceduralmente a partir de uma seed, com terreno carregado em chunks, florestas, grama, água, céu dinâmico com raios de sol, pequenos assentamentos e objetos e recursos espalhados para interagir. Tem um atlas do mundo para ver onde você está, bússola no HUD, modos de caminhada e de voo e controles de toque com joystick virtual para celular.

Além do jogo existem outras duas páginas. A página blockout é uma oficina de estruturas pós apocalípticas, com módulos detalhados, texturas PBR, interiores onde dá para entrar e uma auditoria de geometria, feita para alimentar a geração de cidades que vem mais para frente. A página survivor é um laboratório para o personagem principal.

Boa parte do conteúdo é gerada por scripts da pasta scripts, que montam o blockout, as texturas, a vegetação, a área ocupada por cada estrutura e a lista de recursos, e também otimizam os assets finais. O jogo ajusta a resolução de renderização sozinho para manter a taxa de quadros estável.

É um projeto de fã, sem ligação com os donos de The Walking Dead.

## Como usar

Os modelos 3D ficam no Git LFS, então instale ele antes de clonar, senão no lugar dos modelos GLB vêm só arquivos de ponteiro. Depois rode pnpm install e pnpm dev e abra localhost na porta 3000. Dá para mudar o mundo pelo endereço, usando seed para escolher o mundo, x e z para escolher o ponto de partida e mode igual a fly para começar voando. A oficina fica no caminho blockout e o laboratório do personagem no caminho survivor.

O pnpm test roda os testes e o pnpm typecheck confere os tipos. O pnpm assets gera os assets de novo.

## Tempo de desenvolvimento

O jogo levou duas semanas e meia para ser feito e está finalizado na forma atual.

## Licença

GNU General Public License versão 3. O texto completo está no arquivo LICENSE.
